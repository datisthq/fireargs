//! The attribute macros of [fireargs](https://docs.rs/fireargs), re-exported there as
//! `#[fireargs::input]`, `#[fireargs::output]` and `#[fireargs::value]`. Depend on
//! `fireargs`, not on this crate: the expansion names `::fireargs` paths.

use proc_macro::TokenStream;

mod attrs;
mod input;
mod output;
mod rename;
mod serde;
mod value;

/// Turn a struct into a command's input: serde and schemars derives, camelCase keys,
/// optional `Option` fields and `#[fireargs(...)]` per field.
#[proc_macro_attribute]
pub fn input(args: TokenStream, item: TokenStream) -> TokenStream {
    input::expand_input(args.into(), item.into())
        .unwrap_or_else(syn::Error::into_compile_error)
        .into()
}

/// Turn a struct into a command's output: serde and schemars derives, camelCase keys,
/// `Option` fields left out when `None`.
#[proc_macro_attribute]
pub fn output(args: TokenStream, item: TokenStream) -> TokenStream {
    output::expand_output(args.into(), item.into())
        .unwrap_or_else(syn::Error::into_compile_error)
        .into()
}

/// Turn a newtype or an enum into a reusable value: its meta, default and `parse` travel
/// to every input field of this type.
#[proc_macro_attribute]
pub fn value(args: TokenStream, item: TokenStream) -> TokenStream {
    value::expand_value(args.into(), item.into())
        .unwrap_or_else(syn::Error::into_compile_error)
        .into()
}
