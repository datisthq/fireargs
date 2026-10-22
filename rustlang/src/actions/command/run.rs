use std::io::Write;

use clap::ArgMatches;
use clap::parser::ValueSource;
use serde_json::{Map, Number, Value};

use super::compile::{JSON_ID, LLMS_ID};
use super::manifest::{build_leaf_tool, build_manifest};
use super::report::{format_input_error, format_value_error};
use crate::actions::error::handle::handle_error;
use crate::models::command::{Command, RunError};
use crate::models::config::RenderError;
use crate::models::context::Context;
use crate::models::error::{Error, InputError, Issue, OutputError, PathSegment};
use crate::models::field::Field;

/// Where a leaf runs: its route path and the `render_error` hooks, nearest first.
pub(crate) struct Scope<'a> {
    pub path: Vec<String>,
    pub hooks: Vec<RenderError>,
    pub out: &'a mut dyn Write,
    pub err: &'a mut dyn Write,
}

/// Run a leaf: print the manifest for `--llms`, else read input from `--json <value>`
/// or argv, validate it, call the handler, validate and print its result.
pub(crate) async fn run_command(
    command: &Command,
    matches: &ArgMatches,
    scope: Scope<'_>,
) -> Result<u8, Error> {
    let Scope {
        path,
        mut hooks,
        out,
        err,
    } = scope;
    let name = match path.last() {
        Some(key) => key.clone(),
        None => command.config.name.clone().unwrap_or_default(),
    };
    if read_flag(matches, LLMS_ID) {
        let manifest = build_manifest(vec![build_leaf_tool(command, &name)]);
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
        command: if path.is_empty() {
            name.clone()
        } else {
            path.join(" ")
        },
    };
    let provided = read_provided_keys(command, matches);

    if let Some(line) = check_conflicts(&command.fields, &provided) {
        writeln!(err, "{line}")?;
        return Ok(1);
    }
    let mut raw = None;
    let value = match &json_input {
        Some(text) => serde_json::from_str::<Value>(text)
            .map_err(|error| InputError::InvalidJson(error.to_string())),
        None => {
            if let Some(line) = check_required_arguments(&command.fields, &provided) {
                writeln!(err, "{line}")?;
                return Ok(1);
            }
            match read_cli_input(&command.fields, matches, &provided) {
                Ok(map) => {
                    raw = Some(map.clone());
                    Ok(Value::Object(map))
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
        Err(RunError::Input(error)) => {
            let issue = Issue {
                path: vec![],
                message: error.to_string(),
            };
            let error = InputError::Invalid(vec![issue]);
            report_input_error(error, command, raw.as_ref(), &hooks, &context, out, err)
        }
        Err(RunError::Failed(error)) => handle_error(&hooks, error, &context, out, err),
    }
}

fn report_input_error(
    error: InputError,
    command: &Command,
    raw: Option<&Map<String, Value>>,
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

fn read_flag(matches: &ArgMatches, id: &str) -> bool {
    matches
        .try_get_one::<bool>(id)
        .ok()
        .flatten()
        .copied()
        .unwrap_or(false)
}

// A value clap filled in itself is not the user's: the schema's default applies
fn read_provided_keys(command: &Command, matches: &ArgMatches) -> Vec<String> {
    let mut provided = vec![];
    for field in &command.fields {
        let source = matches.value_source(&field.key);
        if !matches!(
            source,
            Some(ValueSource::CommandLine | ValueSource::EnvVariable)
        ) {
            continue;
        }
        if field.is_flag() && !read_flag(matches, &field.key) {
            continue;
        }
        provided.push(field.key.clone());
    }
    provided
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
) -> Result<Map<String, Value>, String> {
    let mut raw = Map::new();
    for field in fields.iter().filter(|field| provided.contains(&field.key)) {
        if field.is_flag() {
            raw.insert(field.key.clone(), Value::Bool(true));
            continue;
        }
        let texts: Vec<String> = matches
            .get_raw(&field.key)
            .map(|values| values.map(|v| v.to_string_lossy().into_owned()).collect())
            .unwrap_or_default();
        let value = match field.is_variadic() {
            true => Value::Array(
                texts
                    .iter()
                    .map(|text| convert_value(field, text))
                    .collect::<Result<_, _>>()?,
            ),
            false => match texts.last() {
                Some(text) => convert_value(field, text)?,
                None => continue,
            },
        };
        raw.insert(field.key.clone(), value);
    }
    for field in fields.iter().filter(|field| provided.contains(&field.key)) {
        for (key, value) in &field.meta.implies {
            if !provided.contains(key) {
                raw.insert(key.clone(), value.clone());
            }
        }
    }
    Ok(raw)
}

fn convert_value(field: &Field, text: &str) -> Result<Value, String> {
    let result = match &field.parse {
        Some(parse) => parse(text),
        None if field.is_numeric() => parse_number(text),
        None => Ok(Value::String(text.to_owned())),
    };
    result.map_err(|message| format_value_error(field, text, &message))
}

fn parse_number(text: &str) -> Result<Value, String> {
    let trimmed = text.trim();
    let number: f64 = trimmed.parse().map_err(|_| "Not a number.".to_owned())?;
    if !number.is_finite() {
        return Err("Not a number.".to_owned());
    }
    if let Ok(integer) = trimmed.parse::<i64>() {
        return Ok(Value::Number(integer.into()));
    }
    Number::from_f64(number)
        .map(Value::Number)
        .ok_or_else(|| "Not a number.".to_owned())
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
            Issue {
                path,
                message: error.to_string(),
            }
        })
        .collect()
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
