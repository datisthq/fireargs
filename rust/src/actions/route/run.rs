use std::ffi::OsString;
use std::io::Write;
use std::path::Path;
use std::process::ExitCode;

use clap::ArgMatches;
use clap::error::{ContextKind, ContextValue, ErrorKind};

use crate::actions::command::compile::{LLMS_ID, VERSION_ID};
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
    let args: Vec<OsString> = args.into_iter().map(Into::into).collect();
    let configured = match route {
        Route::Command(command) => command.config.name.clone(),
        Route::Program(program) => program.config.name.clone(),
    };
    let name = configured.unwrap_or_else(|| read_binary_name(&args));
    let mut clap = declare_route(route, &name);
    // clap names the usage line after argv[0] unless told otherwise
    if clap.get_bin_name().is_none() {
        clap = clap.bin_name(&name);
    }
    let matches = match clap.try_get_matches_from_mut(args) {
        Ok(matches) => matches,
        Err(error) => {
            let text = error.render().to_string();
            return match error.kind() {
                ErrorKind::DisplayHelp | ErrorKind::DisplayVersion => {
                    write!(out, "{text}")?;
                    Ok(0)
                }
                ErrorKind::InvalidSubcommand => {
                    let name = match error.get(ContextKind::InvalidSubcommand) {
                        Some(ContextValue::String(name)) => name.as_str(),
                        _ => "",
                    };
                    writeln!(err, "error: unknown command '{name}'")?;
                    Ok(1)
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
        let version = matches.try_get_one::<bool>(VERSION_ID).ok().flatten();
        if let (Some(true), Some(text)) = (version, clap.get_version()) {
            writeln!(out, "{text}")?;
            return Ok(0);
        }
        let program = match route {
            Route::Command(command) => {
                let scope = Scope {
                    name,
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
            let manifest = build_manifest(collect_tools(program, &path.join(" ")), false);
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

fn read_binary_name(args: &[OsString]) -> String {
    args.first()
        .and_then(|arg| Path::new(arg).file_stem())
        .and_then(|stem| stem.to_str())
        .map_or_else(|| "command".to_owned(), str::to_owned)
}
