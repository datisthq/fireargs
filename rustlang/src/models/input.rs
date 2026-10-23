use std::fmt::Display;
use std::marker::PhantomData;
use std::sync::Arc;

use schemars::{JsonSchema, Schema};
use serde::Serialize;
use serde::de::DeserializeOwned;
use serde_json::Value;

use super::field::ParseFn;
use crate::settings::FIREARGS_META_KEY;

/// A command's input: `#[fireargs::input]` implements it. A hand-written serde and
/// schemars struct takes an empty `impl fireargs::Input for MyInput {}` and loses only
/// `parse` and the defaults of `#[fireargs::value]` types.
pub trait Input: DeserializeOwned + JsonSchema + 'static {
    #[doc(hidden)]
    fn __fields() -> Vec<FieldSpec> {
        vec![]
    }
}

/// What the macros know about one input key that a JSON Schema cannot hold.
#[doc(hidden)]
pub struct FieldSpec {
    pub key: String,
    pub parse: Option<ParseFn>,
    pub default: Option<Value>,
}

/// Implemented by `#[fireargs::value]`: the `default` and `parse` its fields inherit.
#[doc(hidden)]
pub trait ValueSpec {
    fn default_value() -> Option<Value>;
    fn parser() -> Option<ParseFn>;
}

/// Asks a field's type for its `ValueSpec`, if it has one. The macros call
/// `(&&Probe::<T>::new()).read_spec()`: method lookup tries `ProbeValue` on `&Probe<T>`
/// first and falls back to `ProbePlain` on `Probe<T>`, which needs no specialisation.
#[doc(hidden)]
pub struct Probe<T>(PhantomData<fn() -> T>);

impl<T> Probe<T> {
    #[allow(clippy::new_without_default)]
    pub fn new() -> Self {
        Probe(PhantomData)
    }
}

#[doc(hidden)]
pub trait ProbeValue {
    fn read_spec(&self) -> (Option<ParseFn>, Option<Value>);
}

impl<T: ValueSpec> ProbeValue for &Probe<T> {
    fn read_spec(&self) -> (Option<ParseFn>, Option<Value>) {
        (T::parser(), T::default_value())
    }
}

#[doc(hidden)]
pub trait ProbePlain {
    fn read_spec(&self) -> (Option<ParseFn>, Option<Value>);
}

impl<T> ProbePlain for Probe<T> {
    fn read_spec(&self) -> (Option<ParseFn>, Option<Value>) {
        (None, None)
    }
}

/// Turn a typed parser into one that yields JSON, as the CLI reader needs.
#[doc(hidden)]
pub fn wrap_parse<F, T, E>(parse: F) -> ParseFn
where
    F: Fn(&str) -> Result<T, E> + Send + Sync + 'static,
    T: Serialize,
    E: Display,
{
    Arc::new(move |text| match parse(text) {
        Ok(value) => serde_json::to_value(value).map_err(|error| error.to_string()),
        Err(error) => Err(error.to_string()),
    })
}

/// Merge `meta` key by key into the schema's fireargs meta, so a field's keys override
/// the ones its `#[fireargs::value]` type set without dropping the rest.
#[doc(hidden)]
pub fn merge_meta(schema: &mut Schema, meta: Value) {
    let (Some(object), Value::Object(meta)) = (schema.as_object_mut(), meta) else {
        return;
    };
    let entry = object
        .entry(FIREARGS_META_KEY)
        .or_insert_with(|| Value::Object(Default::default()));
    if let Value::Object(existing) = entry {
        existing.extend(meta);
    }
}
