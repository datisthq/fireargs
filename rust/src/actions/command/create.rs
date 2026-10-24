use std::sync::Arc;

use schemars::JsonSchema;
use schemars::generate::SchemaSettings;
use serde::Serialize;
use serde_json::Value;

use super::compile::compile_command;
use crate::models::command::{Command, Handler, build_runner};
use crate::models::config::{Config, FlagConfig, impl_config_methods};
use crate::models::context::Context;
use crate::models::error::Error;
use crate::models::input::Input;

/// Open a command builder: configure it, then `.handler(...)` types and builds it.
pub fn create_command() -> CommandBuilder {
    CommandBuilder::default()
}

/// A command waiting for its handler.
#[derive(Clone, Default)]
pub struct CommandBuilder {
    config: Config,
}

impl_config_methods!(CommandBuilder);

impl CommandBuilder {
    /// The `--json [value]` flag: kept, turned off or renamed.
    pub fn json_option(mut self, flag: FlagConfig) -> Self {
        self.config.json_option = flag;
        self
    }

    /// The handler, which receives the validated input and the context; its input and
    /// output types become the command's, so annotate the input: `async |input: In, _|`.
    pub fn handler<I, O, H>(self, handler: H) -> Command<I, O>
    where
        I: Input,
        O: Serialize + JsonSchema + 'static,
        H: AsyncFn(I, Context) -> Result<O, Error> + Send + Sync + 'static,
    {
        let handler = Arc::new(handler);
        let handler: Handler<I, O> = Arc::new(move |input, context| {
            let handler = Arc::clone(&handler);
            Box::pin(async move { handler(input, context).await })
        });
        let leaf = compile_command(
            self.config,
            generate_schema::<I>(SchemaSettings::draft2020_12().for_deserialize()),
            generate_schema::<O>(SchemaSettings::draft2020_12().for_serialize()),
            I::__fields(),
            build_runner(Arc::clone(&handler), None),
        );
        Command {
            leaf,
            handler,
            render: None,
        }
    }
}

// Inlined, so a field's meta and shape sit on its property, not behind a `$ref`
fn generate_schema<T: JsonSchema>(mut settings: SchemaSettings) -> Value {
    settings.inline_subschemas = true;
    settings
        .into_generator()
        .into_root_schema_for::<T>()
        .to_value()
}
