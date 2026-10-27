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
            let shape = read_shape(property);
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

fn read_shape(property: &Value) -> Shape {
    let schema = unwrap_nullable(property);
    if let Some(values) = read_choice_values(schema) {
        return Shape::Choice(values);
    }
    let types: Vec<&str> = match schema.get("type") {
        Some(Value::String(name)) => vec![name.as_str()],
        Some(Value::Array(names)) => names.iter().filter_map(Value::as_str).collect(),
        _ => vec![],
    };
    let types: Vec<&str> = types.into_iter().filter(|name| *name != "null").collect();
    match types.as_slice() {
        ["boolean"] => Shape::Bool,
        ["integer"] | ["number"] => Shape::Number,
        ["string"] => Shape::String,
        ["array"] => match schema.get("prefixItems").and_then(Value::as_array) {
            Some(items) => Shape::Tuple(items.iter().map(read_shape).collect()),
            None => Shape::Array(Box::new(read_shape(
                schema.get("items").unwrap_or(&Value::Null),
            ))),
        },
        _ => Shape::Other,
    }
}

// An enum reads as `enum`, or as `oneOf` consts once a variant has a doc comment
fn read_choice_values(schema: &Value) -> Option<Vec<Value>> {
    let values: Vec<Value> =
        if let Some(values) = schema.get("enum").and_then(Value::as_array) {
            values.clone()
        } else if let Some(value) = schema.get("const") {
            vec![value.clone()]
        } else {
            let branches = ["oneOf", "anyOf"]
                .iter()
                .find_map(|key| schema.get(*key).and_then(Value::as_array))?;
            let mut values = vec![];
            for branch in branches
                .iter()
                .filter(|b| b.get("type") != Some(&"null".into()))
            {
                values.extend(read_choice_values(branch)?);
            }
            values
        };
    let values: Vec<Value> = values
        .into_iter()
        .filter(|value| !value.is_null())
        .collect();
    match values.is_empty() {
        true => None,
        false => Some(values),
    }
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
