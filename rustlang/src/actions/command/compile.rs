use std::sync::Arc;

use clap::{Arg, ArgAction};
use serde_json::Value;

use crate::actions::field::read::read_fields;
use crate::models::command::{Command, Runner};
use crate::models::config::{CommandConfig, FlagConfig};
use crate::models::field::{Field, ParseFn};
use crate::settings::FIREARGS_META_KEY;

pub(crate) const JSON_ID: &str = "fireargs:json";
pub(crate) const LLMS_ID: &str = "fireargs:llms";

/// Build a `Command` from the builder state: read the fields from the input schema,
/// attach each `parse`, and compile both schemas, stripped of meta, into validators.
pub(crate) fn compile_command(
    config: CommandConfig,
    input: Value,
    output: Value,
    parsers: Vec<(String, ParseFn)>,
    runner: Runner,
) -> Command {
    let mut fields = read_fields(&input);
    for (key, parse) in parsers {
        match fields.iter_mut().find(|field| field.key == key) {
            Some(field) => field.parse = Some(parse),
            None => panic!("`parse` names '{key}', which is not an input key"),
        }
    }
    let input = strip_schema(input);
    let output = strip_schema(output);
    Command {
        input_validator: Arc::new(build_validator(&input)),
        output_validator: Arc::new(build_validator(&output)),
        input_schema: input,
        output_schema: output,
        config,
        fields,
        runner,
    }
}

/// Declare a leaf as a clap command named `name`. Nothing is required to clap:
/// fireargs reports missing values itself, worded like the twins.
pub(crate) fn declare_command(command: &Command, name: &str) -> clap::Command {
    let config = &command.config;
    let mut clap = apply_identity(
        clap::Command::new(name.to_owned()),
        Identity {
            description: config.description.as_deref(),
            summary: config.summary.as_deref(),
            aliases: &config.aliases,
            usage: config.usage.as_deref(),
            version: config.version.as_deref(),
            before_help: config.before_help.as_deref(),
            after_help: config.after_help.as_deref(),
        },
    );
    let arguments = command.fields.iter().filter(|field| field.is_argument());
    for (index, field) in arguments.enumerate() {
        clap = clap.arg(declare_argument(field, index + 1));
    }
    for field in command.fields.iter().filter(|field| !field.is_argument()) {
        clap = clap.arg(declare_option(field));
    }
    if let Some((long, description)) = read_flag(
        &config.json_option,
        "json",
        "write output as JSON; pass a JSON string to also drive input",
    ) {
        let arg = Arg::new(JSON_ID)
            .long(long)
            .help(description)
            .value_name("value");
        clap = clap.arg(arg.num_args(0..=1).action(ArgAction::Set));
    }
    if let Some((long, description)) = read_flag(
        &config.llms_option,
        "llms",
        "print this command's schema (name, input, output) as JSON for LLM tool-use",
    ) {
        clap = clap.arg(
            Arg::new(LLMS_ID)
                .long(long)
                .help(description)
                .action(ArgAction::SetTrue),
        );
    }
    clap
}

pub(crate) struct Identity<'a> {
    pub description: Option<&'a str>,
    pub summary: Option<&'a str>,
    pub aliases: &'a [String],
    pub usage: Option<&'a str>,
    pub version: Option<&'a str>,
    pub before_help: Option<&'a str>,
    pub after_help: Option<&'a str>,
}

/// Apply the identity and help config a command and a program share.
pub(crate) fn apply_identity(
    mut clap: clap::Command,
    props: Identity<'_>,
) -> clap::Command {
    clap = clap.args_override_self(true);
    if let Some(about) = props.summary.or(props.description) {
        clap = clap.about(about.to_owned());
    }
    if let Some(description) = props.description {
        clap = clap.long_about(description.to_owned());
    }
    for alias in props.aliases {
        clap = clap.visible_alias(alias.clone());
    }
    if let Some(usage) = props.usage {
        clap = clap.override_usage(usage.to_owned());
    }
    if let Some(version) = props.version {
        clap = clap.version(version.to_owned());
    }
    if let Some(text) = props.before_help {
        clap = clap.before_help(text.to_owned());
    }
    if let Some(text) = props.after_help {
        clap = clap.after_help(text.to_owned());
    }
    clap
}

/// The long name and description of a built-in flag, or `None` when it is turned off.
pub(crate) fn read_flag(
    config: &FlagConfig,
    long: &str,
    description: &str,
) -> Option<(String, String)> {
    match config {
        FlagConfig::Enabled => Some((long.to_owned(), description.to_owned())),
        FlagConfig::Disabled => None,
        FlagConfig::Custom { long, description } => {
            Some((long.clone(), description.clone()))
        }
    }
}

fn declare_argument(field: &Field, index: usize) -> Arg {
    let arg = Arg::new(field.key.clone())
        .index(index)
        .value_name(field.cli_name.clone())
        .help(describe_field(field))
        .allow_negative_numbers(field.is_numeric());
    if field.is_variadic() {
        return arg.num_args(1..).action(ArgAction::Append);
    }
    arg.action(ArgAction::Set)
}

fn declare_option(field: &Field) -> Arg {
    let mut arg = Arg::new(field.key.clone())
        .long(field.cli_name.clone())
        .help(describe_field(field))
        .hide(field.meta.hidden)
        .allow_negative_numbers(field.is_numeric());
    if let Some(short) = field.meta.short {
        arg = arg.short(short);
    }
    if let Some(env) = &field.meta.env {
        arg = arg.env(env.clone());
    }
    if let Some(group) = &field.meta.help_group {
        arg = arg.help_heading(group.clone());
    }
    if field.is_flag() {
        return arg.action(ArgAction::SetTrue);
    }
    arg = arg.value_name("value");
    if let Some(preset) = &field.meta.preset {
        let preset = match preset {
            Value::String(text) => text.clone(),
            value => value.to_string(),
        };
        arg = arg.num_args(0..=1).default_missing_value(preset);
    }
    if field.is_variadic() {
        return arg.num_args(1..).action(ArgAction::Append);
    }
    arg.action(ArgAction::Set)
}

// Worded as commander's help: `Rows to read (choices: "a", "b", default: 20)`
fn describe_field(field: &Field) -> String {
    let mut notes = vec![];
    if let Some(choices) = field.choices.as_ref().filter(|_| field.parse.is_none()) {
        let quoted: Vec<String> = choices.iter().map(|c| format!("\"{c}\"")).collect();
        notes.push(format!("choices: {}", quoted.join(", ")));
    }
    if let Some(text) = &field.meta.default_description {
        notes.push(format!("default: {text}"));
    } else if let Some(default) = &field.default {
        notes.push(format!("default: {default}"));
    }
    let description = field.description.clone().unwrap_or_default();
    match notes.is_empty() {
        true => description,
        false => format!("{description} ({})", notes.join(", "))
            .trim()
            .to_owned(),
    }
}

fn build_validator(schema: &Value) -> jsonschema::Validator {
    match jsonschema::validator_for(schema) {
        Ok(validator) => validator,
        Err(error) => panic!("schemars produced an invalid JSON Schema: {error}"),
    }
}

/// Strip fireargs meta from every subschema, and the Rust type name from the root.
pub(crate) fn strip_schema(mut schema: Value) -> Value {
    if let Some(root) = schema.as_object_mut() {
        root.remove("title");
    }
    strip_meta(&mut schema);
    schema
}

fn strip_meta(schema: &mut Value) {
    match schema {
        Value::Object(map) => {
            map.remove(FIREARGS_META_KEY);
            for (key, value) in map.iter_mut() {
                match key.as_str() {
                    // Maps of named subschemas: their keys are names, not keywords
                    "properties" | "$defs" | "patternProperties" => {
                        if let Value::Object(named) = value {
                            named.values_mut().for_each(strip_meta);
                        }
                    }
                    "enum" | "const" | "default" | "examples" => {}
                    _ => strip_meta(value),
                }
            }
        }
        Value::Array(items) => items.iter_mut().for_each(strip_meta),
        _ => {}
    }
}

#[cfg(test)]
#[path = "compile_unit.rs"]
mod unit;
