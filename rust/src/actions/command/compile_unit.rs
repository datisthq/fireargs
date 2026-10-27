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

#[test]
fn bounds_integer_formats_without_loosening_a_declared_range() {
    let schema = json!({
        "properties": {
            "count": {"type": "integer", "format": "uint32", "minimum": 1},
            "small": {"type": "integer", "format": "int8", "maximum": 1000},
            "rows": {"type": "array", "items": {"type": "integer", "format": "uint16"}},
            "format": {"type": "string", "default": "uint8"},
        },
    });
    assert_eq!(
        bound_integers(schema),
        json!({
            "properties": {
                "count": {"type": "integer", "format": "uint32", "minimum": 1, "maximum": 4_294_967_295_u32},
                "small": {"type": "integer", "format": "int8", "maximum": 127, "minimum": -128},
                "rows": {
                    "type": "array",
                    "items": {"type": "integer", "format": "uint16", "minimum": 0, "maximum": 65_535},
                },
                "format": {"type": "string", "default": "uint8"},
            },
        })
    );
}
