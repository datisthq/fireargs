use proc_macro2::TokenStream;
use quote::quote;
use syn::{Fields, ItemStruct, parse_quote};

use crate::attrs::take_fireargs_attrs;
use crate::input::{mark_optional, prepare_struct, read_option_inner};
use crate::serde::read_serde_attrs;

/// Expand `#[fireargs::output]`: derives, camelCase keys, `None` fields left out, and
/// `#[fireargs(...)]` limited to `flatten` and the schemars validation keys.
pub(crate) fn expand_output(
    args: TokenStream,
    item: TokenStream,
) -> syn::Result<TokenStream> {
    if !args.is_empty() {
        return Err(syn::Error::new_spanned(
            args,
            "#[fireargs::output] takes no arguments",
        ));
    }
    let mut item: ItemStruct = syn::parse2(item)?;
    prepare_struct(&mut item, "#[fireargs::output]")?;
    let Fields::Named(fields) = &mut item.fields else {
        return Err(syn::Error::new_spanned(
            &item,
            "expected a struct with named fields",
        ));
    };
    for field in fields.named.iter_mut() {
        let fireargs = take_fireargs_attrs(&mut field.attrs)?;
        fireargs.check_keys(&["flatten", "schemars"], "on an output field")?;
        let serde = read_serde_attrs(&field.attrs)?;
        if fireargs.flatten {
            field.attrs.push(parse_quote!(#[serde(flatten)]));
        }
        if read_option_inner(&field.ty).is_some() {
            mark_optional(&mut field.attrs, &serde);
        }
        for tokens in &fireargs.schemars {
            field.attrs.push(parse_quote!(#[schemars(#tokens)]));
        }
    }
    Ok(quote!(#item))
}
