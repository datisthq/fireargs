use serde_json::Value;

use crate::models::field::{Field, FieldMeta, Shape};
use crate::settings::FIREARGS_META_KEY;

/// Read every input field, in declaration order, from the input struct's JSON Schema:
/// its meta, description, default, required-ness and value shape.
pub(crate) fn read_fields(schema: &Value) -> Vec<Field> {
    let required: Vec<&str> = schema
        .get("required")
        .and_then(Value::as_array)
        .map(|keys| keys.iter().filter_map(Value::as_str).collect())
        .unwrap_or_default();
    let Some(properties) = schema.get("properties").and_then(Value::as_object) else {
        return vec![];
    };
    properties
        .iter()
        .map(|(key, property)| {
            let meta = read_field_meta(key, property);
            let (shape, choices) = read_shape(property);
            Field {
                key: key.clone(),
                cli_name: derive_cli_name(key, meta.name.as_deref()),
                description: property
                    .get("description")
                    .and_then(Value::as_str)
                    .map(str::to_owned),
                default: property.get("default").cloned(),
                required: required.contains(&key.as_str()),
                shape,
                choices,
                parse: None,
                meta,
            }
        })
        .collect()
}

// A typo in the meta must fail loudly: read leniently, the field would silently
// turn back into a plain `--option`
fn read_field_meta(key: &str, property: &Value) -> FieldMeta {
    match property.get(FIREARGS_META_KEY) {
        None => FieldMeta::default(),
        Some(meta) => match serde_json::from_value(meta.clone()) {
            Ok(meta) => meta,
            Err(error) => panic!("invalid fireargs meta on field '{key}': {error}"),
        },
    }
}

/// Turn an input key into its CLI name: `headerRows` and `header_rows` give `header-rows`.
pub(crate) fn derive_cli_name(key: &str, name: Option<&str>) -> String {
    if let Some(name) = name {
        return name.to_owned();
    }
    let chars: Vec<char> = key.trim_matches('_').chars().collect();
    let mut text = String::new();
    for (i, &c) in chars.iter().enumerate() {
        let prev = i.checked_sub(1).map(|j| chars[j]);
        let next = chars.get(i + 1).copied();
        let after_lower =
            prev.is_some_and(|p| p.is_ascii_lowercase() || p.is_ascii_digit());
        let ends_acronym = prev.is_some_and(|p| p.is_ascii_uppercase())
            && next.is_some_and(|n| n.is_ascii_lowercase());
        if c.is_ascii_uppercase() && (after_lower || ends_acronym) {
            text.push('-');
        }
        text.push(if c == '_' {
            '-'
        } else {
            c.to_ascii_lowercase()
        });
    }
    text
}

fn read_shape(property: &Value) -> (Shape, Option<Vec<String>>) {
    let schema = unwrap_nullable(property);
    let choices = schema.get("enum").and_then(Value::as_array).map(|values| {
        values
            .iter()
            .filter_map(Value::as_str)
            .map(str::to_owned)
            .collect()
    });
    let types: Vec<&str> = match schema.get("type") {
        Some(Value::String(name)) => vec![name.as_str()],
        Some(Value::Array(names)) => names.iter().filter_map(Value::as_str).collect(),
        _ => vec![],
    };
    let types: Vec<&str> = types.into_iter().filter(|name| *name != "null").collect();
    let shape = match types.as_slice() {
        ["boolean"] => Shape::Bool,
        ["integer"] | ["number"] => Shape::Number,
        ["string"] => Shape::String,
        ["array"] => {
            let items = schema.get("items").unwrap_or(&Value::Null);
            let (inner, item_choices) = read_shape(items);
            return (Shape::Array(Box::new(inner)), item_choices);
        }
        _ if choices.is_some() => Shape::String,
        _ => Shape::Other,
    };
    (shape, choices)
}

// `Option<T>` reads as `anyOf: [T, {type: null}]` when `T` is not a plain type
fn unwrap_nullable(schema: &Value) -> &Value {
    for key in ["anyOf", "oneOf"] {
        if let Some(branches) = schema.get(key).and_then(Value::as_array) {
            let mut rest = branches
                .iter()
                .filter(|b| b.get("type") != Some(&"null".into()));
            if let (Some(only), None) = (rest.next(), rest.next()) {
                return unwrap_nullable(only);
            }
        }
    }
    schema
}

#[cfg(test)]
#[path = "read_unit.rs"]
mod unit;
