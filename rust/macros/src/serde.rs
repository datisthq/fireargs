use proc_macro2::TokenStream;
use syn::{Attribute, Expr, LitStr, Token};

/// The `#[serde(...)]` keys already written on an item, so the macros never repeat one.
#[derive(Default)]
pub(crate) struct SerdeAttrs {
    pub names: Vec<String>,
    pub rename: Option<LitStr>,
    pub rename_all: Option<LitStr>,
}

impl SerdeAttrs {
    pub fn has(&self, name: &str) -> bool {
        self.names.iter().any(|known| known == name)
    }
}

/// Read every `#[serde(...)]` attribute: the key names, and `rename` / `rename_all` when
/// they are plain strings.
pub(crate) fn read_serde_attrs(attrs: &[Attribute]) -> syn::Result<SerdeAttrs> {
    let mut serde = SerdeAttrs::default();
    for attr in attrs.iter().filter(|attr| attr.path().is_ident("serde")) {
        attr.parse_nested_meta(|meta| {
            let name = meta
                .path
                .get_ident()
                .map(ToString::to_string)
                .unwrap_or_default();
            if meta.input.peek(Token![=]) {
                let value: Expr = meta.value()?.parse()?;
                if let Expr::Lit(syn::ExprLit {
                    lit: syn::Lit::Str(text),
                    ..
                }) = value
                {
                    match name.as_str() {
                        "rename" => serde.rename = Some(text),
                        "rename_all" => serde.rename_all = Some(text),
                        _ => {}
                    }
                }
            } else if meta.input.peek(syn::token::Paren) {
                let content;
                syn::parenthesized!(content in meta.input);
                content.parse::<TokenStream>()?;
            }
            serde.names.push(name);
            Ok(())
        })?;
    }
    Ok(serde)
}
