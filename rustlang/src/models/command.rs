use std::ffi::OsString;
use std::future::Future;
use std::io::Write;
use std::pin::Pin;
use std::process::ExitCode;
use std::sync::Arc;

use jsonschema::Validator;
use serde_json::Value;

use super::config::CommandConfig;
use super::context::Context;
use super::error::Error;
use super::field::Field;
use super::route::Route;
use crate::actions::route::run::{run_route, run_route_from};

pub(crate) type BoxFuture<T> = Pin<Box<dyn Future<Output = T>>>;

/// The type-erased handler: input JSON in, output JSON (and a deferred render) out.
pub(crate) type Runner =
    Arc<dyn Fn(Value, Context) -> BoxFuture<Result<Outcome, RunError>> + Send + Sync>;

pub(crate) struct Outcome {
    pub output: Value,
    pub render: Option<Box<dyn FnOnce() -> Option<String>>>,
}

pub(crate) enum RunError {
    Input(serde_json::Error),
    Failed(Error),
}

/// A leaf built by `command(...)...handler(...)`: typed input, output and a handler,
/// compiled to a clap command when run.
#[derive(Clone)]
pub struct Command {
    pub(crate) config: CommandConfig,
    pub(crate) fields: Vec<Field>,
    pub(crate) input_schema: Value,
    pub(crate) output_schema: Value,
    pub(crate) input_validator: Arc<Validator>,
    pub(crate) output_validator: Arc<Validator>,
    pub(crate) runner: Runner,
}

impl Command {
    /// Run with `std::env::args_os()`, blocking on the handler, and return the exit code.
    pub fn run(&self) -> ExitCode {
        pollster::block_on(self.run_async())
    }

    /// Run with `std::env::args_os()` inside an existing async runtime.
    pub async fn run_async(&self) -> ExitCode {
        run_route(&Route::Command(Box::new(self.clone()))).await
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
        run_route_from(&Route::Command(Box::new(self.clone())), args, out, err).await
    }
}
