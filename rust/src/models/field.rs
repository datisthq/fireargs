use std::sync::Arc;

use serde::Deserialize;
use serde_json::{Map, Value};

/// Turns one CLI string (from argv or `env`) into the field's JSON value; `--json`
/// input skips it.
pub type ParseFn = Arc<dyn Fn(&str) -> Result<Value, String> + Send + Sync>;

/// Per-field meta, read from the `fireargs` key of a property's JSON Schema. The keys
/// are the TypeScript twin's `ArgumentConfig` / `OptionConfig`, camelCase as on the wire.
#[derive(Clone, Debug, Default, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub(crate) struct FieldMeta {
    #[serde(default)]
    pub kind: FieldKind,
    pub name: Option<String>,
    pub short: Option<char>,
    pub env: Option<String>,
    #[serde(default)]
    pub conflicts: OneOrMany,
    #[serde(default)]
    pub implies: Map<String, Value>,
    #[serde(default)]
    pub hidden: bool,
    pub preset: Option<Value>,
    pub help_group: Option<String>,
    pub default_description: Option<String>,
}

#[derive(Clone, Copy, Debug, Default, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub(crate) enum FieldKind {
    Argument,
    #[default]
    Option,
}

#[derive(Clone, Debug, Default, Deserialize)]
#[serde(untagged)]
pub(crate) enum OneOrMany {
    #[default]
    None,
    One(String),
    Many(Vec<String>),
}

impl OneOrMany {
    pub fn to_vec(&self) -> Vec<String> {
        match self {
            OneOrMany::None => vec![],
            OneOrMany::One(key) => vec![key.clone()],
            OneOrMany::Many(keys) => keys.clone(),
        }
    }
}

/// The value type a field's schema describes, with `null` and optionality removed.
#[derive(Clone, Debug, PartialEq)]
pub(crate) enum Shape {
    Bool,
    Number,
    String,
    Array(Box<Shape>),
    Other,
}

/// One input field, compiled from its property schema and meta.
#[derive(Clone)]
pub(crate) struct Field {
    pub key: String,
    pub cli_name: String,
    pub meta: FieldMeta,
    pub description: Option<String>,
    pub default: Option<Value>,
    pub required: bool,
    pub shape: Shape,
    pub choices: Option<Vec<String>>,
    pub parse: Option<ParseFn>,
}

impl Field {
    pub fn is_argument(&self) -> bool {
        self.meta.kind == FieldKind::Argument
    }

    pub fn is_flag(&self) -> bool {
        !self.is_argument() && self.shape == Shape::Bool && self.parse.is_none()
    }

    // A field with `parse` takes one token, so `parse` sees the whole string
    pub fn is_variadic(&self) -> bool {
        self.parse.is_none() && matches!(self.shape, Shape::Array(_))
    }

    pub fn is_numeric(&self) -> bool {
        match &self.shape {
            Shape::Number => true,
            Shape::Array(inner) => **inner == Shape::Number,
            _ => false,
        }
    }

    /// Whether the flag also gets `--no-<name>`: a boolean defaulting to true does.
    pub fn has_negation(&self) -> bool {
        self.is_flag()
            && self.default == Some(Value::Bool(true))
            && !self.cli_name.starts_with("no-")
    }

    /// The clap id of the flag's `--no-<name>`.
    pub fn negation_id(&self) -> String {
        format!("fireargs:no:{}", self.key)
    }

    /// The flags as commander prints them in errors: `-l, --limit <value>`.
    pub fn flags(&self) -> String {
        let short = self
            .meta
            .short
            .map(|c| format!("-{c}, "))
            .unwrap_or_default();
        let long = format!("{short}--{}", self.cli_name);
        if self.is_flag() {
            return long;
        }
        let value = format!("value{}", if self.is_variadic() { "..." } else { "" });
        match self.meta.preset {
            Some(_) => format!("{long} [{value}]"),
            None => format!("{long} <{value}>"),
        }
    }
}
