use std::future::Future;
use std::marker::PhantomData;
use std::sync::Arc;

use schemars::JsonSchema;
use schemars::generate::SchemaSettings;
use serde::Serialize;
use serde::de::DeserializeOwned;
use serde_json::Value;

use super::compile::compile_command;
use crate::models::command::{Command, Outcome, RunError, Runner};
use crate::models::config::CommandConfig;
use crate::models::context::{Context, RenderContext};
use crate::models::error::Error;
use crate::models::field::ParseFn;

type RenderFn<I, O> =
    Arc<dyn Fn(&O, &RenderContext<'_, I>) -> Option<String> + Send + Sync>;

/// Open a command builder: `.input::<I>()`, `.output::<O>()` and `.handler(...)` are
/// required, in that order; `.parse(...)` and `.render(...)` are optional before
/// `.handler(...)`.
pub fn create_command(config: CommandConfig) -> CommandBuilder {
    CommandBuilder { config }
}

/// The first builder step; pick the input struct.
pub struct CommandBuilder {
    config: CommandConfig,
}

/// The second builder step; pick the output type.
pub struct InputBuilder<I> {
    config: CommandConfig,
    input: PhantomData<fn() -> I>,
}

/// The last builder step: optional `parse` and `render`, then the handler.
pub struct OutputBuilder<I, O> {
    config: CommandConfig,
    parsers: Vec<(String, ParseFn)>,
    render: Option<RenderFn<I, O>>,
}

impl CommandBuilder {
    /// The input struct: its fields become arguments and options.
    pub fn input<I: DeserializeOwned + JsonSchema + 'static>(self) -> InputBuilder<I> {
        InputBuilder {
            config: self.config,
            input: PhantomData,
        }
    }
}

impl<I: DeserializeOwned + JsonSchema + 'static> InputBuilder<I> {
    /// The output type, validated on every run and written as JSON under `--json`.
    pub fn output<O: Serialize + JsonSchema + 'static>(self) -> OutputBuilder<I, O> {
        OutputBuilder {
            config: self.config,
            parsers: vec![],
            render: None,
        }
    }
}

impl<I, O> OutputBuilder<I, O>
where
    I: DeserializeOwned + JsonSchema + 'static,
    O: Serialize + JsonSchema + 'static,
{
    /// Turn the CLI string of the input field `key` into its JSON value. It runs on argv
    /// and `env` values, never on `--json` input, and makes the field take one token.
    pub fn parse<F>(mut self, key: &str, parse: F) -> Self
    where
        F: Fn(&str) -> Result<Value, String> + Send + Sync + 'static,
    {
        self.parsers.push((key.to_owned(), Arc::new(parse)));
        self
    }

    /// Turn the output into text for humans; never runs under `--json`.
    pub fn render<F>(mut self, render: F) -> Self
    where
        F: Fn(&O, &RenderContext<'_, I>) -> Option<String> + Send + Sync + 'static,
    {
        self.render = Some(Arc::new(render));
        self
    }

    /// The handler, which receives the validated input and the context.
    pub fn handler<H, Fut, E>(self, handler: H) -> Command
    where
        H: Fn(I, Context) -> Fut + Send + Sync + 'static,
        Fut: Future<Output = Result<O, E>> + 'static,
        E: Into<Error>,
    {
        let handler = Arc::new(handler);
        let render = self.render;
        let runner: Runner = Arc::new(move |value: Value, context: Context| {
            let handler = Arc::clone(&handler);
            let render = render.clone();
            Box::pin(async move {
                let input: I =
                    serde_json::from_value(value.clone()).map_err(RunError::Input)?;
                let output = handler(input, context.clone())
                    .await
                    .map_err(|error| RunError::Failed(error.into()))?;
                let json = serde_json::to_value(&output)
                    .map_err(|error| RunError::Failed(error.into()))?;
                let render = render.filter(|_| !context.json).map(|render| {
                    Box::new(move || {
                        let input: I = serde_json::from_value(value).ok()?;
                        let context = RenderContext {
                            json: false,
                            command: context.command,
                            input: &input,
                        };
                        render(&output, &context)
                    }) as Box<dyn FnOnce() -> Option<String>>
                });
                Ok(Outcome {
                    output: json,
                    render,
                })
            })
        });
        compile_command(
            self.config,
            generate_schema::<I>(SchemaSettings::draft2020_12().for_deserialize()),
            generate_schema::<O>(SchemaSettings::draft2020_12().for_serialize()),
            self.parsers,
            runner,
        )
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
