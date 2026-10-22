use std::ffi::OsString;
use std::io::Write;
use std::process::ExitCode;

use super::config::ProgramConfig;
use super::error::Error;
use super::route::Route;
use crate::actions::route::run::{run_route, run_route_from};

/// A subcommand tree built by `program(...).router(...)`.
#[derive(Clone)]
pub struct Program {
    pub(crate) config: ProgramConfig,
    pub(crate) routes: Vec<(String, Route)>,
}

impl Program {
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
