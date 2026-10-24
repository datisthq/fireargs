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
