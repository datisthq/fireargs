use clap::{Arg, ArgAction};

use crate::actions::command::compile::{
    Identity, LLMS_ID, apply_identity, declare_command, read_flag,
};
use crate::actions::command::manifest::{Tool, build_leaf_tool};
use crate::models::program::Program;
use crate::models::route::Route;

/// Declare a program as a clap command named `name`, each route mounted under its key.
pub(crate) fn declare_program(program: &Program, name: &str) -> clap::Command {
    let config = &program.config;
    let mut clap = apply_identity(
        clap::Command::new(name.to_owned()),
        Identity {
            description: config.description.as_deref(),
            summary: config.summary.as_deref(),
            aliases: &config.aliases,
            usage: config.usage.as_deref(),
            version: config.version.as_deref(),
            before_help: config.before_help.as_deref(),
            after_help: config.after_help.as_deref(),
        },
    );
    if let Some((long, description)) = read_flag(
        &config.llms_option,
        "llms",
        "print the program manifest (subcommand schemas) as JSON for LLM tool-use",
    ) {
        clap = clap.arg(
            Arg::new(LLMS_ID)
                .long(long)
                .help(description)
                .action(ArgAction::SetTrue),
        );
    }
    for (key, route) in &program.routes {
        clap = clap.subcommand(declare_route(route, key));
    }
    clap
}

/// Declare a route as a clap command named `name`.
pub(crate) fn declare_route(route: &Route, name: &str) -> clap::Command {
    match route {
        Route::Command(command) => declare_command(command, name),
        Route::Program(program) => declare_program(program, name),
    }
}

/// Collect the tool of every leaf below, named by its space-separated route path.
pub(crate) fn collect_tools(program: &Program, prefix: &str) -> Vec<Tool> {
    let mut tools = vec![];
    for (key, route) in &program.routes {
        let path = match prefix.is_empty() {
            true => key.clone(),
            false => format!("{prefix} {key}"),
        };
        match route {
            Route::Command(command) => tools.push(build_leaf_tool(command, &path)),
            Route::Program(program) => tools.extend(collect_tools(program, &path)),
        }
    }
    tools
}
