use serde_json::{Map, json};

use super::*;
use crate::actions::field::read::read_fields;

fn read_echo_fields() -> Vec<Field> {
    read_fields(&json!({
        "properties": {
            "path": {"type": "string", "fireargs": {"kind": "argument"}},
            "limit": {"type": "integer", "fireargs": {"kind": "option", "short": "l"}},
            "rows": {"type": "array", "items": {"type": "integer"}},
        },
        "required": ["path", "limit"],
    }))
}

fn issue(path: Vec<PathSegment>, message: &str) -> Issue {
    Issue {
        path,
        message: message.to_owned(),
    }
}

#[test]
fn words_missing_values_like_commander() {
    let error = InputError::Invalid(vec![
        issue(vec![PathSegment::Key("path".into())], "required"),
        issue(vec![PathSegment::Key("limit".into())], "required"),
    ]);
    let text = format_input_error(&error, &read_echo_fields(), Some(&Map::new()));
    assert_eq!(
        text,
        "error: missing required argument 'path'\n\
         error: required option '-l, --limit <value>' not specified"
    );
}

#[test]
fn reports_the_failing_element_of_a_variadic_once() {
    let mut raw = Map::new();
    raw.insert("rows".into(), json!([1, -2, -3]));
    let path = |i| vec![PathSegment::Key("rows".into()), PathSegment::Index(i)];
    let error = InputError::Invalid(vec![
        issue(path(1), "too small"),
        issue(path(2), "too small"),
    ]);
    assert_eq!(
        format_input_error(&error, &read_echo_fields(), Some(&raw)),
        "error: option '--rows <value...>' argument '-2' is invalid. too small"
    );
}

#[test]
fn words_json_issues_with_their_dot_path() {
    let path = vec![PathSegment::Key("rows".into()), PathSegment::Index(0)];
    let error = InputError::Invalid(vec![issue(path, "bad"), issue(vec![], "worse")]);
    assert_eq!(
        format_input_error(&error, &read_echo_fields(), None),
        "error: invalid --json input at 'rows[0]': bad\nerror: invalid --json input: worse"
    );
}
