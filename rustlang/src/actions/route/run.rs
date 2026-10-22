use std::ffi::OsString;
use std::io::Write;
use std::process::ExitCode;

use clap::ArgMatches;
use clap::error::ErrorKind;

use crate::actions::command::compile::LLMS_ID;
use crate::actions::command::manifest::build_manifest;
use crate::actions::command::run::{Scope, run_command};
use crate::actions::program::compile::{collect_tools, declare_route};
use crate::models::error::Error;
use crate::models::route::Route;

/// Run a route with `std::env::args_os()` on stdout and stderr; an error no hook
/// handled is printed as `error: ...` with exit code 1.
pub(crate) async fn run_route(route: &Route) -> ExitCode {
    let mut out = std::io::stdout();
    let mut err = std::io::stderr();
    match run_route_from(route, std::env::args_os(), &mut out, &mut err).await {
        Ok(code) => ExitCode::from(code),
        Err(error) => {
            let _ = writeln!(err, "error: {error}");
            ExitCode::FAILURE
        }
    }
}

/// Parse `args` (binary name first) against a route and run the leaf it selects.
pub(crate) async fn run_route_from<A, T>(
    route: &Route,
    args: A,
    out: &mut dyn Write,
    err: &mut dyn Write,
) -> Result<u8, Error>
where
    A: IntoIterator<Item = T>,
    T: Into<OsString>,
{
    let name = match route {
        Route::Command(command) => command.config.name.clone(),
        Route::Program(program) => program.config.name.clone(),
    };
    let args: Vec<OsString> = args.into_iter().map(Into::into).collect();
    let mut clap = declare_route(route, &name.unwrap_or_default());
    let matches = match clap.try_get_matches_from_mut(args) {
        Ok(matches) => matches,
        Err(error) => {
            let text = error.render().to_string();
            return match error.kind() {
                ErrorKind::DisplayHelp | ErrorKind::DisplayVersion => {
                    write!(out, "{text}")?;
                    Ok(0)
                }
                _ => {
                    write!(err, "{text}")?;
                    Ok(1)
                }
            };
        }
    };

    let mut route = route;
    let mut matches: &ArgMatches = &matches;
    let mut clap = &mut clap;
    let mut path = vec![];
    let mut hooks = vec![];
    loop {
        let program = match route {
            Route::Command(command) => {
                let scope = Scope {
                    path,
                    hooks,
                    out,
                    err,
                };
                return run_command(command, matches, scope).await;
            }
            Route::Program(program) => program,
        };
        if let Some(render_error) = &program.config.render_error {
            hooks.insert(0, render_error.clone());
        }
        let llms = matches.try_get_one::<bool>(LLMS_ID).ok().flatten().copied();
        if llms == Some(true) {
            let manifest = build_manifest(collect_tools(program, &path.join(" ")));
            writeln!(out, "{}", serde_json::to_string_pretty(&manifest)?)?;
            return Ok(0);
        }
        let Some((key, sub_matches)) = matches.subcommand() else {
            write!(out, "{}", clap.render_help())?;
            return Ok(0);
        };
        let Some((_, sub_route)) = program.routes.iter().find(|(k, _)| k == key) else {
            return Ok(1);
        };
        let Some(sub_clap) = clap.find_subcommand_mut(key) else {
            return Ok(1);
        };
        path.push(key.to_owned());
        route = sub_route;
        matches = sub_matches;
        clap = sub_clap;
    }
}
