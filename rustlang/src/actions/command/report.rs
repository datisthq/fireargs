use serde_json::{Map, Value};

use crate::models::error::{InputError, Issue, PathSegment, format_path};
use crate::models::field::Field;

/// Word a failed input parse like commander's own parse errors: one line per `--json`
/// issue, or the first issue per field for argv input (`raw`).
pub(crate) fn format_input_error(
    error: &InputError,
    fields: &[Field],
    raw: Option<&Map<String, Value>>,
) -> String {
    match (error, raw) {
        (InputError::InvalidJson(message), _) => {
            format!("error: --json value is not valid JSON: {message}")
        }
        (InputError::Invalid(issues), None) => issues
            .iter()
            .map(format_json_issue)
            .collect::<Vec<_>>()
            .join("\n"),
        (InputError::Invalid(issues), Some(raw)) => pick_first_issues(issues)
            .into_iter()
            .map(|issue| format_cli_issue(issue, fields, raw))
            .collect::<Vec<_>>()
            .join("\n"),
    }
}

/// Word a CLI string that `parse` or number parsing rejected.
pub(crate) fn format_value_error(field: &Field, value: &str, message: &str) -> String {
    if field.is_argument() {
        let name = &field.cli_name;
        return format!(
            "error: command-argument value '{value}' is invalid for argument '{name}'. {message}"
        );
    }
    format!(
        "error: option '{}' argument '{value}' is invalid. {message}",
        field.flags()
    )
}

fn pick_first_issues(issues: &[Issue]) -> Vec<&Issue> {
    let mut seen = vec![];
    issues
        .iter()
        .filter(|issue| match issue.path.first() {
            None => true,
            Some(key) if seen.contains(&key) => false,
            Some(key) => {
                seen.push(key);
                true
            }
        })
        .collect()
}

fn format_json_issue(issue: &Issue) -> String {
    let path = format_path(&issue.path);
    if path.is_empty() {
        return format!("error: invalid --json input: {}", issue.message);
    }
    format!("error: invalid --json input at '{path}': {}", issue.message)
}

fn format_cli_issue(issue: &Issue, fields: &[Field], raw: &Map<String, Value>) -> String {
    let field = match issue.path.first() {
        Some(PathSegment::Key(key)) => fields.iter().find(|field| &field.key == key),
        _ => None,
    };
    let Some(field) = field else {
        return format!("error: invalid input. {}", issue.message);
    };
    let Some(value) = raw.get(&field.key) else {
        if field.is_argument() {
            return format!("error: missing required argument '{}'", field.cli_name);
        }
        return format!("error: required option '{}' not specified", field.flags());
    };
    let shown = match (value, issue.path.get(1)) {
        (Value::Array(items), Some(PathSegment::Index(index)))
            if *index < items.len() =>
        {
            format_scalar(&items[*index])
        }
        (Value::Array(items), _) => items
            .iter()
            .map(format_scalar)
            .collect::<Vec<_>>()
            .join(" "),
        (value, _) => format_scalar(value),
    };
    format_value_error(field, &shown, &issue.message)
}

fn format_scalar(value: &Value) -> String {
    match value {
        Value::String(text) => text.clone(),
        value => value.to_string(),
    }
}

#[cfg(test)]
#[path = "report_unit.rs"]
mod unit;
