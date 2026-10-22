use std::sync::Arc;

use serde_json::Value;

use super::context::Context;
use super::error::Error;

/// Turns a failed run into output: in JSON mode a returned value is written as JSON to
/// stdout, otherwise a returned string goes to stderr. The exit code is then 1.
pub type RenderError = Arc<dyn Fn(&Error, &Context) -> Option<Value> + Send + Sync>;

/// A built-in flag (`--json`, `--llms`): kept as is, turned off, or renamed.
#[derive(Clone, Debug, Default)]
pub enum FlagConfig {
    #[default]
    Enabled,
    Disabled,
    Custom {
        long: String,
        description: String,
    },
}

/// Configuration for a single command. Every field is optional; per-field concerns
/// (descriptions, defaults, choices) live in the input struct, never here.
#[derive(Clone, Default)]
pub struct CommandConfig {
    /// Command name shown in usage and help. Falls back to the router key.
    pub name: Option<String>,
    /// Long-form description shown in `--help` and the `--llms` manifest.
    pub description: Option<String>,
    /// One-line summary shown in subcommand listings; falls back to description.
    pub summary: Option<String>,
    /// Alternate invocation names.
    pub aliases: Vec<String>,
    /// Overrides the auto-generated usage line.
    pub usage: Option<String>,
    /// Version string, which adds `-V, --version`.
    pub version: Option<String>,
    /// Text printed before the generated help.
    pub before_help: Option<String>,
    /// Text printed after the generated help.
    pub after_help: Option<String>,
    /// The `--json [value]` flag.
    pub json_option: FlagConfig,
    /// The `--llms` flag.
    pub llms_option: FlagConfig,
    /// Turns an error from a run into output; the nearest hook wins.
    pub render_error: Option<RenderError>,
}

/// Configuration for a program: a command's, without `--json`, which only leaves have.
#[derive(Clone, Default)]
pub struct ProgramConfig {
    /// Program name shown in usage and help. Falls back to the router key.
    pub name: Option<String>,
    /// Long-form description shown in `--help`.
    pub description: Option<String>,
    /// One-line summary shown in subcommand listings; falls back to description.
    pub summary: Option<String>,
    /// Alternate invocation names.
    pub aliases: Vec<String>,
    /// Overrides the auto-generated usage line.
    pub usage: Option<String>,
    /// Version string, which adds `-V, --version`.
    pub version: Option<String>,
    /// Text printed before the generated help.
    pub before_help: Option<String>,
    /// Text printed after the generated help.
    pub after_help: Option<String>,
    /// The `--llms` flag, which prints the manifest of every leaf below.
    pub llms_option: FlagConfig,
    /// Turns an error from a run of any leaf below into output, unless a nearer one does.
    pub render_error: Option<RenderError>,
}
