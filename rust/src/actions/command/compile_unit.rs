use serde_json::json;

use super::*;

#[test]
fn strips_meta_but_not_a_property_named_like_it() {
    let schema = json!({
        "title": "EchoInput",
        "properties": {
            "path": {"type": "string", "fireargs": {"kind": "argument"}},
            "fireargs": {"type": "boolean", "default": {"fireargs": 1}},
        },
    });
    let stripped = strip_schema(schema);
    assert_eq!(
        stripped,
        json!({
            "properties": {
                "path": {"type": "string"},
                "fireargs": {"type": "boolean", "default": {"fireargs": 1}},
            },
        })
    );
}

#[test]
fn fills_properties_only_on_a_bare_object_root() {
    let bare = json!({"type": "object"});
    assert_eq!(
        fill_properties(bare),
        json!({"type": "object", "properties": {}})
    );
    for schema in [
        json!({"type": "object", "properties": {"a": {}}}),
        json!({"type": "object", "additionalProperties": {"type": "string"}}),
        json!({"type": "object", "patternProperties": {"^a": {}}}),
        json!({"type": "string"}),
        json!(true),
    ] {
        assert_eq!(fill_properties(schema.clone()), schema);
    }
}
