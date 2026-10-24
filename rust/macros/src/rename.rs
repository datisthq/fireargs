use syn::LitStr;

/// Apply a serde `rename_all` rule to a snake_case field name, as serde does.
pub(crate) fn rename_key(name: &str, rule: &LitStr) -> syn::Result<String> {
    let name = name.strip_prefix("r#").unwrap_or(name);
    let words: Vec<&str> = name.split('_').filter(|word| !word.is_empty()).collect();
    let text = match rule.value().as_str() {
        "lowercase" => name.to_lowercase(),
        "UPPERCASE" => name.to_uppercase(),
        "snake_case" => name.to_owned(),
        "SCREAMING_SNAKE_CASE" => name.to_uppercase(),
        "kebab-case" => name.replace('_', "-"),
        "SCREAMING-KEBAB-CASE" => name.replace('_', "-").to_uppercase(),
        "PascalCase" => words.iter().map(|word| capitalize(word)).collect(),
        "camelCase" => {
            let mut text = words
                .first()
                .map(|word| word.to_string())
                .unwrap_or_default();
            text.extend(words.iter().skip(1).map(|word| capitalize(word)));
            text
        }
        _ => {
            return Err(syn::Error::new(
                rule.span(),
                "unknown serde rename_all rule",
            ));
        }
    };
    Ok(text)
}

fn capitalize(word: &str) -> String {
    let mut chars = word.chars();
    match chars.next() {
        Some(first) => first.to_uppercase().chain(chars).collect(),
        None => String::new(),
    }
}

#[cfg(test)]
#[path = "rename_unit.rs"]
mod unit;
