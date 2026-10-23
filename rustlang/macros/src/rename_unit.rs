use syn::LitStr;

use super::*;

fn rename(name: &str, rule: &str) -> String {
    rename_key(name, &LitStr::new(rule, proc_macro2::Span::call_site()))
        .unwrap_or_default()
}

#[test]
fn renames_fields_as_serde_does() {
    assert_eq!(rename("header_rows", "camelCase"), "headerRows");
    assert_eq!(rename("header_rows", "PascalCase"), "HeaderRows");
    assert_eq!(rename("header_rows", "kebab-case"), "header-rows");
    assert_eq!(rename("header_rows", "SCREAMING_SNAKE_CASE"), "HEADER_ROWS");
    assert_eq!(rename("r#type", "camelCase"), "type");
}
