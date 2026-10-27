use std::ffi::OsString;
use std::future::Future;
use std::io::Write;
use std::pin::Pin;
use std::process::ExitCode;
use std::sync::Arc;

use jsonschema::Validator;
use serde_json::Value;

use super::config::Config;
use super::context::{Context, RenderContext};
use super::error::{Error, Issue, OutputError, read_path};
use super::field::Field;
use super::route::Route;
use crate::actions::output::serialize::serialize_output;
use crate::actions::route::run::{run_route, run_route_from};

pub(crate) type BoxFuture<T> = Pin<Box<dyn Future<Output = T>>>;

/// The type-erased handler: input JSON in, output JSON (and a deferred render) out.
pub(crate) type Runner =
    Arc<dyn Fn(Value, Context) -> BoxFuture<Result<Outcome, RunError>> + Send + Sync>;

pub(crate) type Handler<I, O> =
    Arc<dyn Fn(I, Context) -> BoxFuture<Result<O, Error>> + Send + Sync>;

pub(crate) type RenderFn<I, O> =
    Arc<dyn Fn(&O, &RenderContext<'_, I>) -> Option<String> + Send + Sync>;

pub(crate) struct Outcome {
    pub output: Value,
    pub render: Option<Box<dyn FnOnce() -> Option<String>>>,
}

pub(crate) enum RunError {
    Input(Issue),
    Failed(Error),
}

/// A compiled leaf, its input and output types erased, as a router mounts it.
#[derive(Clone)]
pub(crate) struct Leaf {
    pub config: Config,
    pub fields: Vec<Field>,
    pub defaults: Vec<(String, Value)>,
    pub input_schema: Value,
    pub output_schema: Value,
    pub input_validator: Arc<Validator>,
    pub output_validator: Arc<Validator>,
    pub runner: Runner,
}

/// A leaf built by `command()...handler(...)`: typed input, output and handler,
/// compiled to a clap command when run or mounted on a program.
pub struct Command<I, O> {
    pub(crate) leaf: Leaf,
    pub(crate) handler: Handler<I, O>,
    pub(crate) render: Option<RenderFn<I, O>>,
}

impl<I, O> Clone for Command<I, O> {
    fn clone(&self) -> Self {
        Command {
            leaf: self.leaf.clone(),
            handler: Arc::clone(&self.handler),
            render: self.render.clone(),
        }
    }
}

impl<I, O> Command<I, O>
where
    I: serde::de::DeserializeOwned + 'static,
    O: serde::Serialize + 'static,
{
    /// Turn the output into text for humans; never runs under `--json`. Return a
    /// `String`, or an `Option<String>` to print nothing.
    pub fn render<F, T>(mut self, render: F) -> Self
    where
        F: Fn(&O, &RenderContext<'_, I>) -> T + Send + Sync + 'static,
        T: Into<Option<String>>,
    {
        self.render = Some(Arc::new(move |output, context| {
            render(output, context).into()
        }));
        self.leaf.runner = build_runner(Arc::clone(&self.handler), self.render.clone());
        self
    }

    /// Run with `std::env::args_os()`, blocking on the handler, and return the exit code.
    pub fn run(&self) -> ExitCode {
        pollster::block_on(self.run_async())
    }

    /// Run with `std::env::args_os()` inside an existing async runtime.
    pub async fn run_async(&self) -> ExitCode {
        run_route(&Route::Command(Box::new(self.leaf.clone()))).await
    }

    /// Run with the given argv (binary name first), writing to `out` and `err`. An
    /// error no `render_error` hook handled is returned instead of printed.
    pub async fn try_run_from<A, T>(
        &self,
        args: A,
        out: &mut dyn Write,
        err: &mut dyn Write,
    ) -> Result<u8, Error>
    where
        A: IntoIterator<Item = T>,
        T: Into<OsString>,
    {
        let route = Route::Command(Box::new(self.leaf.clone()));
        run_route_from(&route, args, out, err).await
    }
}

/// Erase a typed handler and render into a runner: deserialize the validated input,
/// call the handler, serialize its output and defer the render until it is printed.
pub(crate) fn build_runner<I, O>(
    handler: Handler<I, O>,
    render: Option<RenderFn<I, O>>,
) -> Runner
where
    I: serde::de::DeserializeOwned + 'static,
    O: serde::Serialize + 'static,
{
    Arc::new(move |value: Value, context: Context| {
        let handler = Arc::clone(&handler);
        let render = render.clone();
        Box::pin(async move {
            let input: I =
                serde_path_to_error::deserialize(value.clone()).map_err(|error| {
                    RunError::Input(Issue {
                        path: read_path(error.path()),
                        message: error.into_inner().to_string(),
                    })
                })?;
            let output = handler(input, context.clone())
                .await
                .map_err(RunError::Failed)?;
            let json = serialize_output(&output).map_err(|issue| {
                RunError::Failed(Box::new(OutputError {
                    issues: vec![issue],
                }))
            })?;
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
    })
}
