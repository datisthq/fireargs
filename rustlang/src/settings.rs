/// The key fireargs reads each field's meta from in the input JSON Schema, set with
/// `#[schemars(extend("fireargs" = {...}))]` and stripped from the `--llms` manifest.
pub const FIREARGS_META_KEY: &str = "fireargs";
