use proc_macro2::TokenStream;
use quote::{format_ident, quote};
use syn::{Expr, Fields, Item, parse_quote};

use crate::attrs::{FireargsAttrs, build_default, read_args, take_fireargs_attrs};
use crate::input::{add_derives, build_transform};
use crate::serde::read_serde_attrs;

const VALUE_KEYS: &[&str] = &[
    "argument",
    "option",
    "name",
    "short",
    "env",
    "hidden",
    "preset",
    "help_group",
    "default_description",
    "default",
    "parse",
];

/// Expand `#[fireargs::value(...)]` on a newtype (`struct Limit(u32);`) or an enum: the
/// derives, the type-level meta, `Default` from `default`, and the hidden `ValueSpec`
/// that hands `default` and `parse` to every input field of this type.
pub(crate) fn expand_value(
    args: TokenStream,
    item: TokenStream,
) -> syn::Result<TokenStream> {
    let fireargs = read_args(args)?;
    fireargs.check_keys(VALUE_KEYS, "on #[fireargs::value]; set it on the field")?;
    let mut item: Item = syn::parse2(item)?;
    let (ident, generics, body) = match &mut item {
        Item::Struct(item) => {
            let Fields::Unnamed(fields) = &mut item.fields else {
                return Err(syn::Error::new_spanned(
                    &item.ident,
                    "expected a newtype such as `struct Limit(u32);`; use \
                     #[fireargs::input] for a block of fields",
                ));
            };
            if fields.unnamed.len() != 1 {
                return Err(syn::Error::new_spanned(
                    &item.ident,
                    "expected exactly one field",
                ));
            }
            let Some(field) = fields.unnamed.first_mut() else {
                return Err(syn::Error::new_spanned(
                    &item.ident,
                    "expected exactly one field",
                ));
            };
            let inner = take_fireargs_attrs(&mut field.attrs)?;
            inner.check_keys(&["schemars"], "on a value's field")?;
            for tokens in &inner.schemars {
                field.attrs.push(parse_quote!(#[schemars(#tokens)]));
            }
            let ty = field.ty.clone();
            add_derives(&mut item.attrs);
            (
                item.ident.clone(),
                item.generics.clone(),
                Body::Newtype(Box::new(ty)),
            )
        }
        Item::Enum(item) => {
            if read_serde_attrs(&item.attrs)?.rename_all.is_none() {
                item.attrs
                    .push(parse_quote!(#[serde(rename_all = "kebab-case")]));
            }
            add_derives(&mut item.attrs);
            (item.ident.clone(), item.generics.clone(), Body::Enum)
        }
        _ => {
            return Err(syn::Error::new_spanned(
                &item,
                "#[fireargs::value] expects a newtype struct or an enum",
            ));
        }
    };

    let mut items = vec![];
    if fireargs.has_meta() {
        let function = format_ident!("__fireargs_meta_{}", ident);
        let meta = fireargs.build_meta(ToString::to_string);
        items.push(build_transform(&function, &meta));
        let attr = parse_quote!(#[schemars(transform = #function)]);
        match &mut item {
            Item::Struct(item) => item.attrs.push(attr),
            Item::Enum(item) => item.attrs.push(attr),
            _ => {}
        }
    }

    let (impl_generics, type_generics, where_clause) = generics.split_for_impl();
    if let Body::Newtype(ty) = &body {
        items.push(quote! {
            impl #impl_generics ::core::ops::Deref for #ident #type_generics #where_clause {
                type Target = #ty;
                fn deref(&self) -> &#ty {
                    &self.0
                }
            }
            impl #impl_generics ::core::ops::DerefMut for #ident #type_generics #where_clause {
                fn deref_mut(&mut self) -> &mut #ty {
                    &mut self.0
                }
            }
            impl #impl_generics ::core::convert::From<#ty> for #ident #type_generics #where_clause {
                fn from(value: #ty) -> Self {
                    Self(value)
                }
            }
        });
    }
    let default = match &fireargs.default {
        Some(Some(value)) => {
            let value = build_value_default(value, &body);
            items.push(quote! {
                impl #impl_generics ::core::default::Default for #ident #type_generics #where_clause {
                    fn default() -> Self {
                        #value
                    }
                }
            });
            quote! {
                ::fireargs::__private::serde_json::to_value(
                    <Self as ::core::default::Default>::default(),
                ).ok()
            }
        }
        Some(None) => {
            return Err(syn::Error::new_spanned(
                &ident,
                "`default` on a value needs one: `default = 20`",
            ));
        }
        None => quote!(None),
    };
    let parse = build_parse(&fireargs);
    items.push(quote! {
        impl #impl_generics ::fireargs::__private::ValueSpec for #ident #type_generics #where_clause {
            fn default_value() -> ::core::option::Option<::fireargs::__private::serde_json::Value> {
                #default
            }
            fn parser() -> ::core::option::Option<::fireargs::__private::ParseFn> {
                #parse
            }
        }
    });
    Ok(quote! {
        #item
        #(#items)*
    })
}

enum Body {
    Newtype(Box<syn::Type>),
    Enum,
}

// A newtype's default is its inner value; an enum's names a variant, `default = User`
fn build_value_default(value: &Expr, body: &Body) -> TokenStream {
    match (body, value) {
        (Body::Newtype(_), _) => {
            let value = build_default(value);
            quote!(Self(#value))
        }
        (Body::Enum, Expr::Path(path)) if path.path.get_ident().is_some() => {
            quote!(Self::#path)
        }
        (Body::Enum, _) => quote!(#value),
    }
}

fn build_parse(fireargs: &FireargsAttrs) -> TokenStream {
    match &fireargs.parse {
        Some(parse) => quote!(Some(::fireargs::__private::wrap_parse(#parse))),
        None => quote!(None),
    }
}
