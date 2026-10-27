use std::io::Write;

use clap::ArgMatches;
use clap::parser::ValueSource;
use serde_json::{Number, Value};

use super::compile::{JSON_ID, LLMS_ID};
use super::manifest::{build_leaf_tool, build_manifest};
use super::report::{CliInput, format_input_error, format_value_error};
use crate::actions::error::handle::handle_error;
use crate::models::command::{Leaf, RunError};
use crate::models::config::RenderError;
use crate::models::context::Context;
use crate::models::error::{Error, InputError, Issue, OutputError, PathSegment};
use crate::models::field::{Field, Shape, format_choice};

/// Where a leaf runs: the root's name, the route path below it and the `render_error`
/// hooks, nearest first.
pub(crate) struct Scope<'a> {
    pub name: String,
    pub path: Vec<String>,
    pub hooks: Vec<RenderError>,
    pub out: &'a mut dyn Write,
    pub err: &'a mut dyn Write,
}

/// Run a leaf: print the manifest for `--llms`, else read input from `--json <value>`
/// or argv, validate it, call the handler, validate and print its result.
pub(crate) async fn run_command(
    command: &Leaf,
    matches: &ArgMatches,
    scope: Scope<'_>,
) -> Result<u8, Error> {
    let Scope {
        name,
        path,
        mut hooks,
        out,
        err,
    } = scope;
    let standalone = path.is_empty();
    let name = match standalone {
        true => name,
        false => path.join(" "),
    };
    if read_flag(matches, LLMS_ID) {
        let tools = vec![build_leaf_tool(command, &name)];
        let manifest = build_manifest(tools, standalone);
        writeln!(out, "{}", serde_json::to_string_pretty(&manifest)?)?;
        return Ok(0);
    }
    if let Some(render_error) = &command.config.render_error {
        hooks.insert(0, render_error.clone());
    }

    let json_given = matches.try_contains_id(JSON_ID).unwrap_or(false)
        && matches.value_source(JSON_ID) == Some(ValueSource::CommandLine);
    let json_input = match json_given {
        true => matches
            .try_get_one::<String>(JSON_ID)
            .ok()
            .flatten()
            .cloned(),
        false => None,
    };
    let context = Context {
        json: json_given,
        command: name.clone(),
    };
    let provided = read_provided_keys(command, matches);

    if let Some(line) = check_conflicts(&command.fields, &provided) {
        writeln!(err, "{line}")?;
        return Ok(1);
    }
    let mut raw = None;
    let value = match &json_input {
        Some(text) => serde_json::from_str::<Value>(text)
            .map(normalize_integers)
            .map_err(|error| InputError::InvalidJson(error.to_string())),
        None => {
            if let Some(line) = check_required_arguments(&command.fields, &provided) {
                writeln!(err, "{line}")?;
                return Ok(1);
            }
            match read_cli_input(&command.fields, matches, &provided) {
                Ok(input) => {
                    let value = Value::Object(input.values.clone());
                    raw = Some(input);
                    Ok(value)
                }
                // A CLI value commander rejects at parse time never reaches the TS hook
                Err(line) => {
                    writeln!(err, "{line}")?;
                    return Ok(1);
                }
            }
        }
    };
    let value = value.and_then(|value| {
        let value = fill_defaults(value, &command.defaults);
        let issues = collect_issues(&command.input_validator, &value);
        match issues.is_empty() {
            true => Ok(value),
            false => Err(InputError::Invalid(issues)),
        }
    });
    let value = match value {
        Ok(value) => value,
        Err(error) => {
            return report_input_error(
                error,
                command,
                raw.as_ref(),
                &hooks,
                &context,
                out,
                err,
            );
        }
    };

    match (command.runner)(value, context.clone()).await {
        Ok(outcome) => {
            let issues = collect_issues(&command.output_validator, &outcome.output);
            if !issues.is_empty() {
                let error = Box::new(OutputError { issues });
                return handle_error(&hooks, error, &context, out, err);
            }
            if context.json {
                writeln!(out, "{}", serde_json::to_string_pretty(&outcome.output)?)?;
            } else if let Some(text) = outcome.render.and_then(|render| render()) {
                writeln!(out, "{text}")?;
            }
            Ok(0)
        }
        Err(RunError::Input(issue)) => {
            let error = InputError::Invalid(vec![issue]);
            report_input_error(error, command, raw.as_ref(), &hooks, &context, out, err)
        }
        Err(RunError::Failed(error)) => handle_error(&hooks, error, &context, out, err),
    }
}

fn report_input_error(
    error: InputError,
    command: &Leaf,
    raw: Option<&CliInput>,
    hooks: &[RenderError],
    context: &Context,
    out: &mut dyn Write,
    err: &mut dyn Write,
) -> Result<u8, Error> {
    if hooks.is_empty() {
        writeln!(err, "{}", format_input_error(&error, &command.fields, raw))?;
        return Ok(1);
    }
    handle_error(hooks, Box::new(error), context, out, err)
}

// serde knows nothing of a reusable type's default, so it is filled in here
fn fill_defaults(mut value: Value, defaults: &[(String, Value)]) -> Value {
    if let Value::Object(map) = &mut value {
        for (key, default) in defaults {
            map.entry(key.clone()).or_insert_with(|| default.clone());
        }
    }
    value
}

fn read_flag(matches: &ArgMatches, id: &str) -> bool {
    matches
        .try_get_one::<bool>(id)
        .ok()
        .flatten()
        .copied()
        .unwrap_or(false)
}

// A value clap filled in itself is not the user's: the schema's default applies.
// A flag's bad env value counts as given, so reading it reports the error
fn read_provided_keys(command: &Leaf, matches: &ArgMatches) -> Vec<String> {
    let mut provided = vec![];
    for field in &command.fields {
        let given = match field.is_flag() {
            true => !matches!(read_flag_value(field, matches), Ok(None)),
            false => matches!(
                matches.value_source(&field.key),
                Some(ValueSource::CommandLine | ValueSource::EnvVariable)
            ),
        };
        if given {
            provided.push(field.key.clone());
        }
    }
    provided
}

const TRUE_WORDS: [&str; 6] = ["1", "true", "yes", "on", "y", "t"];
const FALSE_WORDS: [&str; 6] = ["0", "false", "no", "off", "n", "f"];

// An empty env var is absent, and a false word an explicit false
fn read_flag_value(field: &Field, matches: &ArgMatches) -> Result<Option<bool>, String> {
    let negated = field.has_negation()
        && matches.value_source(&field.negation_id()) == Some(ValueSource::CommandLine);
    if negated {
        return Ok(Some(false));
    }
    match matches.value_source(&field.key) {
        Some(ValueSource::CommandLine) => Ok(Some(true)),
        Some(ValueSource::EnvVariable) => {
            let value = matches
                .try_get_one::<String>(&field.key)
                .ok()
                .flatten()
                .cloned()
                .unwrap_or_default();
            let word = value.trim().to_lowercase();
            if word.is_empty() {
                return Ok(None);
            }
            if TRUE_WORDS.contains(&word.as_str()) {
                return Ok(Some(true));
            }
            if FALSE_WORDS.contains(&word.as_str()) {
                return Ok(Some(false));
            }
            let env = field.meta.env.clone().unwrap_or_default();
            Err(format_value_error(
                field,
                &value,
                "Not a boolean.",
                Some(&env),
            ))
        }
        _ => Ok(None),
    }
}

fn check_conflicts(fields: &[Field], provided: &[String]) -> Option<String> {
    for field in fields.iter().filter(|field| provided.contains(&field.key)) {
        for other in field.meta.conflicts.to_vec() {
            if provided.contains(&other) {
                let other_flags = fields
                    .iter()
                    .find(|f| f.key == other)
                    .map(Field::flags)
                    .unwrap_or(other);
                let flags = field.flags();
                return Some(format!(
                    "error: option '{flags}' cannot be used with option '{other_flags}'"
                ));
            }
        }
    }
    None
}

fn check_required_arguments(fields: &[Field], provided: &[String]) -> Option<String> {
    fields
        .iter()
        .find(|field| {
            field.is_argument() && field.required && !provided.contains(&field.key)
        })
        .map(|field| format!("error: missing required argument '{}'", field.cli_name))
}

fn read_cli_input(
    fields: &[Field],
    matches: &ArgMatches,
    provided: &[String],
) -> Result<CliInput, String> {
    let mut raw = CliInput::default();
    for field in fields.iter().filter(|field| provided.contains(&field.key)) {
        if field.is_flag() {
            if let Some(value) = read_flag_value(field, matches)? {
                raw.values.insert(field.key.clone(), Value::Bool(value));
            }
            continue;
        }
        let env = match matches.value_source(&field.key) {
            Some(ValueSource::EnvVariable) => field.meta.env.clone(),
            _ => None,
        };
        let texts: Vec<String> = matches
            .get_raw(&field.key)
            .map(|values| values.map(|v| v.to_string_lossy().into_owned()).collect())
            .unwrap_or_default();
        let env_name = env.as_deref();
        let (value, tokens) = match field.is_variadic() {
            true => (
                Value::Array(
                    texts
                        .iter()
                        .enumerate()
                        .map(|(index, text)| convert_value(field, text, index, env_name))
                        .collect::<Result<_, _>>()?,
                ),
                texts,
            ),
            false => match texts.last() {
                Some(text) => {
                    (convert_value(field, text, 0, env_name)?, vec![text.clone()])
                }
                None => continue,
            },
        };
        raw.values.insert(field.key.clone(), value);
        raw.tokens.insert(field.key.clone(), tokens);
        if let Some(env) = env {
            raw.envs.insert(field.key.clone(), env);
        }
    }
    for field in fields.iter().filter(|field| provided.contains(&field.key)) {
        for (key, value) in &field.meta.implies {
            if !provided.contains(key) {
                raw.values.insert(key.clone(), value.clone());
            }
        }
    }
    Ok(raw)
}

fn convert_value(
    field: &Field,
    text: &str,
    index: usize,
    env: Option<&str>,
) -> Result<Value, String> {
    let result = match &field.parse {
        Some(parse) => parse(text),
        None => convert_token(field.read_shape_at(index), text),
    };
    result.map_err(|message| format_value_error(field, text, &message, env))
}

fn convert_token(shape: Option<&Shape>, text: &str) -> Result<Value, String> {
    match shape {
        Some(Shape::Number) => parse_number(text),
        Some(Shape::Choice(values)) => {
            let choices: Vec<String> = values.iter().map(format_choice).collect();
            match choices.iter().position(|choice| choice == text) {
                Some(index) => Ok(values[index].clone()),
                None => Err(format!("Allowed choices are {}.", choices.join(", "))),
            }
        }
        _ => Ok(Value::String(text.to_owned())),
    }
}

// Shared by every twin: no hex, no digit separators, no `inf` or `nan`
fn parse_number(text: &str) -> Result<Value, String> {
    let text = text.trim_matches([' ', '\t', '\n', '\x0C', '\r']);
    let fail = || "Not a number.".to_owned();
    if !is_number_token(text) {
        return Err(fail());
    }
    if let Ok(integer) = text.parse::<i64>() {
        return Ok(Value::Number(integer.into()));
    }
    if let Ok(integer) = text.parse::<u64>() {
        return Ok(Value::Number(integer.into()));
    }
    let number: f64 = text.parse().map_err(|_| fail())?;
    match read_integral(number) {
        Some(integer) => Ok(integer),
        None => Number::from_f64(number).map(Value::Number).ok_or_else(fail),
    }
}

fn is_number_token(text: &str) -> bool {
    let digits = |part: &str| part.bytes().all(|byte| byte.is_ascii_digit());
    let unsigned = text.strip_prefix(['+', '-']).unwrap_or(text);
    let (mantissa, exponent) = match unsigned.split_once(['e', 'E']) {
        Some((mantissa, exponent)) => (mantissa, Some(exponent)),
        None => (unsigned, None),
    };
    let (whole, fraction) = mantissa.split_once('.').unwrap_or((mantissa, ""));
    let exponent_valid = exponent.is_none_or(|exponent| {
        let exponent = exponent.strip_prefix(['+', '-']).unwrap_or(exponent);
        !exponent.is_empty() && digits(exponent)
    });
    !(whole.is_empty() && fraction.is_empty())
        && digits(whole)
        && digits(fraction)
        && exponent_valid
}

// An integral float is an integer to the schema: serde reads no `u32` from `1000.0`
fn read_integral(number: f64) -> Option<Value> {
    const LIMIT: f64 = 18_446_744_073_709_551_616.0;
    if number.fract() != 0.0 || number.abs() >= LIMIT {
        return None;
    }
    match number < 0.0 {
        true if number >= i64::MIN as f64 => Some(Value::Number((number as i64).into())),
        true => None,
        false => Some(Value::Number((number as u64).into())),
    }
}

// zod and pydantic take `3.0` for an integer field; serde reads no `u32` from it
fn normalize_integers(value: Value) -> Value {
    match value {
        Value::Number(number) => match number.as_f64().filter(|_| number.is_f64()) {
            Some(float) => read_integral(float).unwrap_or(Value::Number(number)),
            None => Value::Number(number),
        },
        Value::Array(items) => {
            Value::Array(items.into_iter().map(normalize_integers).collect())
        }
        Value::Object(map) => Value::Object(
            map.into_iter()
                .map(|(key, value)| (key, normalize_integers(value)))
                .collect(),
        ),
        value => value,
    }
}

fn collect_issues(validator: &jsonschema::Validator, value: &Value) -> Vec<Issue> {
    validator
        .iter_errors(value)
        .map(|error| {
            let mut path = read_pointer(&error.instance_path().to_string());
            // A missing key is reported at its parent; zod reports it at the key
            if let jsonschema::error::ValidationErrorKind::Required { property } =
                error.kind()
                && let Some(key) = property.as_str()
            {
                path.push(PathSegment::Key(key.to_owned()));
            }
            let message = match error.kind() {
                jsonschema::error::ValidationErrorKind::Enum { options } => {
                    format_enum_message(error.instance(), options)
                }
                _ => error.to_string(),
            };
            Issue { path, message }
        })
        .collect()
}

// `Option<T>` puts `null` among an enum's values, which no `--json` value needs named
fn format_enum_message(instance: &Value, options: &Value) -> String {
    let options: Vec<String> = options
        .as_array()
        .into_iter()
        .flatten()
        .filter(|option| !option.is_null())
        .map(Value::to_string)
        .collect();
    let listed = match options.split_last() {
        Some((last, rest)) if !rest.is_empty() => {
            format!("{} or {last}", rest.join(", "))
        }
        _ => options.join(""),
    };
    format!("{instance} is not one of {listed}")
}

fn read_pointer(pointer: &str) -> Vec<PathSegment> {
    pointer
        .split('/')
        .skip(1)
        .map(|part| {
            let part = part.replace("~1", "/").replace("~0", "~");
            match part.parse() {
                Ok(index) => PathSegment::Index(index),
                Err(_) => PathSegment::Key(part),
            }
        })
        .collect()
}
