use proc_macro2::TokenStream;
use quote::{format_ident, quote};
use syn::{Attribute, Fields, Ident, ItemStruct, LitStr, Type, parse_quote};

use crate::attrs::{build_default, take_fireargs_attrs};
use crate::rename::rename_key;
use crate::serde::read_serde_attrs;

const FIELD_KEYS: &[&str] = &[
    "argument",
    "option",
    "name",
    "short",
    "env",
    "conflicts",
    "implies",
    "hidden",
    "preset",
    "help_group",
    "default_description",
    "default",
    "parse",
    "flatten",
    "schemars",
];

/// Expand `#[fireargs::input]`: derives, camelCase keys, `Option` fields optional, each
/// `#[fireargs(...)]` turned into serde and schemars attributes, and `impl Input`.
pub(crate) fn expand_input(
    args: TokenStream,
    item: TokenStream,
) -> syn::Result<TokenStream> {
    if !args.is_empty() {
        return Err(syn::Error::new_spanned(
            args,
            "#[fireargs::input] takes no arguments",
        ));
    }
    let mut item: ItemStruct = syn::parse2(item)?;
    let rule = prepare_struct(&mut item, "#[fireargs::input]")?;
    let struct_name = item.ident.clone();
    let Fields::Named(fields) = &mut item.fields else {
        return Err(syn::Error::new_spanned(
            &item,
            "expected a struct with named fields",
        ));
    };

    let mut keys: Vec<(Ident, String)> = vec![];
    for field in &fields.named {
        let ident = field.ident.clone().unwrap_or_else(|| format_ident!("_"));
        let serde = read_serde_attrs(&field.attrs)?;
        let key = match serde.rename {
            Some(rename) => rename.value(),
            None => rename_key(&ident.to_string(), &rule)?,
        };
        keys.push((ident, key));
    }
    let resolve = |ident: &Ident| {
        keys.iter()
            .find(|(field, _)| field == ident)
            .map(|(_, key)| key.clone())
            .unwrap_or_else(|| ident.to_string())
    };

    let mut items = vec![];
    let mut specs = vec![];
    for (field, (ident, key)) in fields.named.iter_mut().zip(&keys) {
        let fireargs = take_fireargs_attrs(&mut field.attrs)?;
        fireargs.check_keys(FIELD_KEYS, "on an input field")?;
        let serde = read_serde_attrs(&field.attrs)?;
        let ty = field.ty.clone();
        if fireargs.flatten {
            if fireargs.has_meta()
                || fireargs.default.is_some()
                || fireargs.parse.is_some()
            {
                return Err(syn::Error::new_spanned(
                    ident,
                    "a flattened block carries its own meta; set it on its fields",
                ));
            }
            field.attrs.push(parse_quote!(#[serde(flatten)]));
            specs.push(quote!(specs.extend(<#ty as ::fireargs::Input>::__fields());));
            continue;
        }

        let inner = read_option_inner(&ty).cloned();
        if inner.is_some() {
            mark_optional(&mut field.attrs, &serde);
        }
        match &fireargs.default {
            Some(None) => field.attrs.push(parse_quote!(#[serde(default)])),
            Some(Some(value)) => {
                let function =
                    format_ident!("__fireargs_default_{}_{}", struct_name, ident);
                let value = build_default(value);
                let path = LitStr::new(&function.to_string(), ident.span());
                items.push(quote! {
                    #[doc(hidden)]
                    #[allow(non_snake_case)]
                    fn #function() -> #ty {
                        #value
                    }
                });
                field.attrs.push(parse_quote!(#[serde(default = #path)]));
            }
            None => {}
        }
        for tokens in &fireargs.schemars {
            field.attrs.push(parse_quote!(#[schemars(#tokens)]));
        }
        if fireargs.has_meta() {
            let function = format_ident!("__fireargs_meta_{}_{}", struct_name, ident);
            let meta = fireargs.build_meta(resolve);
            items.push(build_transform(&function, &meta));
            field
                .attrs
                .push(parse_quote!(#[schemars(transform = #function)]));
        }

        let probed = inner.as_ref().unwrap_or(&ty);
        let parse = match &fireargs.parse {
            Some(parse) => quote!(Some(::fireargs::__private::wrap_parse(#parse))),
            None => quote!(None),
        };
        let default = match inner.is_none()
            && fireargs.default.is_none()
            && !serde.has("default")
        {
            true => quote!(_default),
            false => quote!(None),
        };
        specs.push(quote! {
            let (parse, _default) =
                (&&::fireargs::__private::Probe::<#probed>::new()).read_spec();
            specs.push(::fireargs::__private::FieldSpec {
                key: #key.to_owned(),
                parse: #parse.or(parse),
                default: #default,
            });
        });
    }

    let (impl_generics, type_generics, where_clause) = item.generics.split_for_impl();
    Ok(quote! {
        #item
        #(#items)*
        impl #impl_generics ::fireargs::Input for #struct_name #type_generics #where_clause {
            fn __fields() -> ::std::vec::Vec<::fireargs::__private::FieldSpec> {
                #[allow(unused_imports)]
                use ::fireargs::__private::{ProbePlain as _, ProbeValue as _};
                let mut specs = ::std::vec::Vec::new();
                #(#specs)*
                specs
            }
        }
    })
}

/// Add the derives and crate paths, and camelCase keys unless a `rename_all` is set;
/// return the rule the keys follow.
pub(crate) fn prepare_struct(item: &mut ItemStruct, place: &str) -> syn::Result<LitStr> {
    take_fireargs_attrs(&mut item.attrs)?
        .check_keys(&[], &format!("on a {place} struct"))?;
    let serde = read_serde_attrs(&item.attrs)?;
    let rule = match serde.rename_all {
        Some(rule) => rule,
        None => {
            item.attrs
                .push(parse_quote!(#[serde(rename_all = "camelCase")]));
            LitStr::new("camelCase", item.ident.span())
        }
    };
    add_derives(&mut item.attrs);
    Ok(rule)
}

/// Put the serde and schemars derives first, naming fireargs' re-exports, so a user
/// crate needs neither in its `Cargo.toml`.
pub(crate) fn add_derives(attrs: &mut Vec<Attribute>) {
    let derives: Vec<Attribute> = vec![
        parse_quote!(#[derive(
            ::fireargs::__private::serde::Deserialize,
            ::fireargs::__private::serde::Serialize,
            ::fireargs::__private::schemars::JsonSchema
        )]),
        parse_quote!(#[serde(crate = "::fireargs::__private::serde")]),
        parse_quote!(#[schemars(crate = "::fireargs::__private::schemars")]),
    ];
    attrs.splice(0..0, derives);
}

/// Leave a `None` out of the JSON both ways, unless the field already says otherwise.
pub(crate) fn mark_optional(
    attrs: &mut Vec<Attribute>,
    serde: &crate::serde::SerdeAttrs,
) {
    if !serde.has("default") {
        attrs.push(parse_quote!(#[serde(default)]));
    }
    if !serde.has("skip_serializing_if") {
        attrs.push(parse_quote!(
            #[serde(skip_serializing_if = "::core::option::Option::is_none")]
        ));
    }
}

/// A schemars transform that merges `meta` into the schema's own, so a field's keys
/// override its type's one by one rather than replacing them all.
pub(crate) fn build_transform(function: &Ident, meta: &TokenStream) -> TokenStream {
    quote! {
        #[doc(hidden)]
        #[allow(non_snake_case)]
        fn #function(schema: &mut ::fireargs::__private::schemars::Schema) {
            ::fireargs::__private::merge_meta(schema, #meta);
        }
    }
}

pub(crate) fn read_option_inner(ty: &Type) -> Option<&Type> {
    let Type::Path(path) = ty else {
        return None;
    };
    let segment = path.path.segments.last()?;
    if segment.ident != "Option" {
        return None;
    }
    let syn::PathArguments::AngleBracketed(args) = &segment.arguments else {
        return None;
    };
    match args.args.first() {
        Some(syn::GenericArgument::Type(inner)) if args.args.len() == 1 => Some(inner),
        _ => None,
    }
}
