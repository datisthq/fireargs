use std::sync::Arc;

use serde_json::Value;

use super::context::Context;
use super::error::Error;

/// Turns a failed run into output: in JSON mode a returned value is written as JSON to
/// stdout, otherwise a returned string goes to stderr. The exit code is then 1.
pub(crate) type RenderError =
    Arc<dyn Fn(&Error, &Context) -> Option<Value> + Send + Sync>;

/// Changes the clap command fireargs declares, after it declares it.
pub(crate) type Configure = Arc<dyn Fn(clap::Command) -> clap::Command + Send + Sync>;

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

/// What a command and a program are both configured with; per-field concerns
/// (descriptions, defaults, choices) live in the input struct, never here.
#[derive(Clone, Default)]
pub(crate) struct Config {
    pub name: Option<String>,
    pub description: Option<String>,
    pub summary: Option<String>,
    pub aliases: Vec<String>,
    pub usage: Option<String>,
    pub version: Option<String>,
    pub before_help: Option<String>,
    pub after_help: Option<String>,
    pub json_option: FlagConfig,
    pub llms_option: FlagConfig,
    pub render_error: Option<RenderError>,
    pub configure: Option<Configure>,
}

/// The configuration methods a command builder and a program share, on `self.config`.
macro_rules! impl_config_methods {
    ($target:ty) => {
        impl $target {
            /// The name shown in usage and help; a router key overrides it.
            pub fn name(mut self, name: impl Into<String>) -> Self {
                self.config.name = Some(name.into());
                self
            }

            /// The long-form description shown in `--help` and the `--llms` manifest.
            pub fn description(mut self, description: impl Into<String>) -> Self {
                self.config.description = Some(description.into());
                self
            }

            /// The one-line summary in subcommand listings; falls back to description.
            pub fn summary(mut self, summary: impl Into<String>) -> Self {
                self.config.summary = Some(summary.into());
                self
            }

            /// Another name the parent routes here; repeat for more.
            pub fn alias(mut self, alias: impl Into<String>) -> Self {
                self.config.aliases.push(alias.into());
                self
            }

            /// Overrides the generated usage line.
            pub fn usage(mut self, usage: impl Into<String>) -> Self {
                self.config.usage = Some(usage.into());
                self
            }

            /// The version string, which adds `-V, --version`.
            pub fn version(mut self, version: impl Into<String>) -> Self {
                self.config.version = Some(version.into());
                self
            }

            /// Text printed before the generated help.
            pub fn before_help(mut self, text: impl Into<String>) -> Self {
                self.config.before_help = Some(text.into());
                self
            }

            /// Text printed after the generated help.
            pub fn after_help(mut self, text: impl Into<String>) -> Self {
                self.config.after_help = Some(text.into());
                self
            }

            /// The `--llms` flag: kept, turned off or renamed.
            pub fn llms_option(mut self, flag: $crate::FlagConfig) -> Self {
                self.config.llms_option = flag;
                self
            }

            /// Turn an error from a run below into output; the nearest hook wins.
            pub fn render_error<F>(mut self, render_error: F) -> Self
            where
                F: Fn(&$crate::Error, &$crate::Context) -> Option<::serde_json::Value>
                    + Send
                    + Sync
                    + 'static,
            {
                self.config.render_error = Some(::std::sync::Arc::new(render_error));
                self
            }

            /// Change the clap command fireargs declares, such as its help template;
            /// arguments added here reach clap but not the input.
            pub fn configure<F>(mut self, configure: F) -> Self
            where
                F: Fn(::clap::Command) -> ::clap::Command + Send + Sync + 'static,
            {
                self.config.configure = Some(::std::sync::Arc::new(configure));
                self
            }
        }
    };
}

pub(crate) use impl_config_methods;
