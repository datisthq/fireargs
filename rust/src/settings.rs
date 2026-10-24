/// The key fireargs reads each field's meta from in the input JSON Schema, written by
/// `#[fireargs(...)]` (or a hand-written `#[schemars(extend("fireargs" = {...}))]`) and
/// stripped from the `--llms` manifest.
pub const FIREARGS_META_KEY: &str = "fireargs";
