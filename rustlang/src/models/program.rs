use std::ffi::OsString;
use std::io::Write;
use std::process::ExitCode;

use super::command::Command;
use super::config::{Config, impl_config_methods};
use super::error::Error;
use super::route::Route;
use crate::actions::route::run::{run_route, run_route_from};

/// A subcommand tree built by `program()` and its `.command(...)` / `.program(...)`.
#[derive(Clone, Default)]
pub struct Program {
    pub(crate) config: Config,
    pub(crate) routes: Vec<(String, Route)>,
}

impl_config_methods!(Program);

impl Program {
    /// Mount a command under `key`, its name on the command line and its path segment
    /// in the `--llms` manifest; the key overrides the command's own name.
    pub fn command<I, O>(
        mut self,
        key: impl Into<String>,
        command: Command<I, O>,
    ) -> Self {
        self.routes
            .push((key.into(), Route::Command(Box::new(command.leaf))));
        self
    }

    /// Mount a nested program under `key`.
    pub fn program(mut self, key: impl Into<String>, program: Program) -> Self {
        self.routes
            .push((key.into(), Route::Program(Box::new(program))));
        self
    }

    /// Run with `std::env::args_os()`, blocking on the handler, and return the exit code.
    pub fn run(&self) -> ExitCode {
        pollster::block_on(self.run_async())
    }

    /// Run with `std::env::args_os()` inside an existing async runtime.
    pub async fn run_async(&self) -> ExitCode {
        run_route(&Route::Program(Box::new(self.clone()))).await
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
        run_route_from(&Route::Program(Box::new(self.clone())), args, out, err).await
    }
}
