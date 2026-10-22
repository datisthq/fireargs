#![allow(clippy::unwrap_used)]
use serde_json::json;

use super::*;

#[test]
fn derives_kebab_case_cli_names() {
    assert_eq!(derive_cli_name("headerRows", None), "header-rows");
    assert_eq!(derive_cli_name("parseHTMLBody", None), "parse-html-body");
    assert_eq!(derive_cli_name("v2Name", None), "v2-name");
    assert_eq!(derive_cli_name("header_rows", None), "header-rows");
    assert_eq!(derive_cli_name("toPath", Some("to")), "to");
}

#[test]
fn reads_fields_in_declaration_order() {
    let schema = json!({
        "properties": {
            "path": {"type": "string", "fireargs": {"kind": "argument"}},
            "role": {"type": ["string", "null"], "enum": ["admin", "user", null]},
            "tags": {"type": "array", "items": {"type": "integer"}, "default": []},
        },
        "required": ["path"],
    });
    let fields = read_fields(&schema);
    let keys: Vec<&str> = fields.iter().map(|f| f.key.as_str()).collect();
    assert_eq!(keys, ["path", "role", "tags"]);
    assert!(fields[0].is_argument() && fields[0].required);
    assert_eq!(fields[1].choices.as_deref().unwrap(), ["admin", "user"]);
    assert_eq!(fields[2].shape, Shape::Array(Box::new(Shape::Number)));
    assert!(fields[2].is_variadic() && !fields[2].required);
}

#[test]
#[should_panic(expected = "invalid fireargs meta on field 'path'")]
fn rejects_unknown_meta_keys() {
    read_fields(
        &json!({"properties": {"path": {"fireargs": {"kind": "argument", "shrot": "p"}}}}),
    );
}
