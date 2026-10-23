use proc_macro2::{Span, TokenStream};
use quote::quote;
use syn::ext::IdentExt;
use syn::meta::ParseNestedMeta;
use syn::{Attribute, Expr, Ident, Lit, LitBool, LitStr, Token};

const SCHEMARS_KEYS: &[&str] = &[
    "range", "length", "pattern", "regex", "contains", "email", "url", "inner",
];

/// The keys of `#[fireargs(...)]`: the meta of the TypeScript `ArgumentConfig` /
/// `OptionConfig` in snake_case, plus `default`, `parse`, `flatten` and the schemars
/// validation keys, which pass through as `#[schemars(...)]`.
#[derive(Default)]
pub(crate) struct FireargsAttrs {
    pub kind: Option<&'static str>,
    pub name: Option<LitStr>,
    pub short: Option<char>,
    pub env: Option<LitStr>,
    pub conflicts: Vec<Ident>,
    pub implies: Vec<(Ident, Expr)>,
    pub hidden: Option<bool>,
    pub preset: Option<Expr>,
    pub help_group: Option<LitStr>,
    pub default_description: Option<LitStr>,
    pub default: Option<Option<Expr>>,
    pub parse: Option<Expr>,
    pub flatten: bool,
    pub schemars: Vec<TokenStream>,
    used: Vec<(String, Span)>,
}

impl FireargsAttrs {
    /// Read one `key`, `key = value` or `key(...)` entry.
    pub fn read_entry(&mut self, meta: ParseNestedMeta) -> syn::Result<()> {
        let key = meta
            .path
            .get_ident()
            .map(ToString::to_string)
            .unwrap_or_default();
        self.used.push((
            key.clone(),
            meta.path
                .get_ident()
                .map_or_else(Span::call_site, Ident::span),
        ));
        match key.as_str() {
            "argument" => self.kind = Some("argument"),
            "option" => self.kind = Some("option"),
            "name" => self.name = Some(meta.value()?.parse()?),
            "short" => self.short = Some(read_short(&meta)?),
            "env" => self.env = Some(meta.value()?.parse()?),
            "help_group" => self.help_group = Some(meta.value()?.parse()?),
            "default_description" => {
                self.default_description = Some(meta.value()?.parse()?)
            }
            "hidden" => {
                let hidden = match meta.input.peek(Token![=]) {
                    true => meta.value()?.parse::<LitBool>()?.value,
                    false => true,
                };
                self.hidden = Some(hidden);
            }
            "preset" => self.preset = Some(meta.value()?.parse()?),
            "conflicts" => {
                let value = meta.value()?;
                if value.peek(syn::token::Bracket) {
                    let content;
                    syn::bracketed!(content in value);
                    let keys = content.parse_terminated(Ident::parse_any, Token![,])?;
                    self.conflicts.extend(keys);
                } else {
                    self.conflicts.push(value.parse()?);
                }
            }
            "implies" => meta.parse_nested_meta(|entry| {
                let Some(key) = entry.path.get_ident().cloned() else {
                    return Err(entry.error("expected a sibling field name"));
                };
                self.implies.push((key, entry.value()?.parse()?));
                Ok(())
            })?,
            "default" => {
                let value = match meta.input.peek(Token![=]) {
                    true => Some(meta.value()?.parse()?),
                    false => None,
                };
                self.default = Some(value);
            }
            "parse" => self.parse = Some(meta.value()?.parse()?),
            "flatten" => self.flatten = true,
            _ if SCHEMARS_KEYS.contains(&key.as_str()) => {
                let path = &meta.path;
                let tokens = if meta.input.peek(syn::token::Paren) {
                    let content;
                    syn::parenthesized!(content in meta.input);
                    let inner: TokenStream = content.parse()?;
                    quote!(#path(#inner))
                } else if meta.input.peek(Token![=]) {
                    let value: Expr = meta.value()?.parse()?;
                    quote!(#path = #value)
                } else {
                    quote!(#path)
                };
                self.schemars.push(tokens);
            }
            _ => return Err(meta.error(format!("unknown fireargs key `{key}`"))),
        }
        Ok(())
    }

    /// Fail on the first key used that `allowed` does not list.
    pub fn check_keys(&self, allowed: &[&str], place: &str) -> syn::Result<()> {
        for (key, span) in &self.used {
            let schemars = SCHEMARS_KEYS.contains(&key.as_str());
            if !allowed.contains(&key.as_str())
                && !(schemars && allowed.contains(&"schemars"))
            {
                return Err(syn::Error::new(
                    *span,
                    format!("`{key}` is not allowed {place}"),
                ));
            }
        }
        Ok(())
    }

    pub fn has_meta(&self) -> bool {
        self.kind.is_some()
            || self.name.is_some()
            || self.short.is_some()
            || self.env.is_some()
            || !self.conflicts.is_empty()
            || !self.implies.is_empty()
            || self.hidden.is_some()
            || self.preset.is_some()
            || self.help_group.is_some()
            || self.default_description.is_some()
    }

    /// The meta as a `json!` call, wire keys camelCase; `resolve` turns a sibling field
    /// name into its input key.
    pub fn build_meta(&self, resolve: impl Fn(&Ident) -> String) -> TokenStream {
        let mut entries = vec![];
        if let Some(kind) = self.kind {
            entries.push(quote!("kind": #kind));
        }
        if let Some(name) = &self.name {
            entries.push(quote!("name": #name));
        }
        if let Some(short) = self.short {
            let short = short.to_string();
            entries.push(quote!("short": #short));
        }
        if let Some(env) = &self.env {
            entries.push(quote!("env": #env));
        }
        match self.conflicts.as_slice() {
            [] => {}
            [one] => {
                let key = resolve(one);
                entries.push(quote!("conflicts": #key));
            }
            many => {
                let keys = many.iter().map(&resolve);
                entries.push(quote!("conflicts": [#(#keys),*]));
            }
        }
        if !self.implies.is_empty() {
            let keys = self.implies.iter().map(|(key, _)| resolve(key));
            let values = self.implies.iter().map(|(_, value)| value);
            entries.push(quote!("implies": { #(#keys: #values),* }));
        }
        if let Some(hidden) = self.hidden {
            entries.push(quote!("hidden": #hidden));
        }
        if let Some(preset) = &self.preset {
            entries.push(quote!("preset": #preset));
        }
        if let Some(group) = &self.help_group {
            entries.push(quote!("helpGroup": #group));
        }
        if let Some(text) = &self.default_description {
            entries.push(quote!("defaultDescription": #text));
        }
        quote!(::fireargs::__private::serde_json::json!({ #(#entries),* }))
    }
}

/// Read and remove every `#[fireargs(...)]` on an item or field: it is no derive's
/// helper attribute, so leaving it would fail to compile.
pub(crate) fn take_fireargs_attrs(
    attrs: &mut Vec<Attribute>,
) -> syn::Result<FireargsAttrs> {
    let mut fireargs = FireargsAttrs::default();
    for attr in attrs.iter().filter(|attr| attr.path().is_ident("fireargs")) {
        attr.parse_nested_meta(|meta| fireargs.read_entry(meta))?;
    }
    attrs.retain(|attr| !attr.path().is_ident("fireargs"));
    Ok(fireargs)
}

/// Read the arguments of `#[fireargs::value(...)]`.
pub(crate) fn read_args(args: TokenStream) -> syn::Result<FireargsAttrs> {
    let mut fireargs = FireargsAttrs::default();
    let parser = syn::meta::parser(|meta| fireargs.read_entry(meta));
    syn::parse::Parser::parse2(parser, args)?;
    Ok(fireargs)
}

/// A `default = "text"` becomes the field's type by `Into`, so `String` fields take a
/// literal; any other expression is used as it is.
pub(crate) fn build_default(value: &Expr) -> TokenStream {
    match value {
        Expr::Lit(syn::ExprLit {
            lit: Lit::Str(_), ..
        }) => quote!(::core::convert::Into::into(#value)),
        _ => quote!(#value),
    }
}

fn read_short(meta: &ParseNestedMeta) -> syn::Result<char> {
    let lit: Lit = meta.value()?.parse()?;
    match &lit {
        Lit::Char(c) => Ok(c.value()),
        Lit::Str(text) if text.value().chars().count() == 1 => {
            Ok(text.value().chars().next().unwrap_or_default())
        }
        _ => Err(syn::Error::new(
            lit.span(),
            "expected a character, such as 'v'",
        )),
    }
}
