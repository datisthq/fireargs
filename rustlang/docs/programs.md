---
title: Programs
path: /rust/programs/
icon: folder-tree
order: 6
description: f::program(...) for subcommand trees, including nested programs.
---

# Programs

`f::program(config).router([...])` builds a CLI tree: `router` takes
`(key, route)` pairs mapping each subcommand name to a command or a nested
program, and `config` is the program's `ProgramConfig`. `.into()` turns a
`Command` or a `Program` into a `Route`.

```rust
use std::process::ExitCode;

use fireargs::{self as f, Command, CommandConfig, Error, ProgramConfig};
use schemars::JsonSchema;
use serde::{Deserialize, Serialize};

#[derive(Deserialize, JsonSchema)]
struct GreetInput {
    name: String,
}

#[derive(Serialize, JsonSchema)]
struct Greeting {
    greeting: String,
}

#[derive(Deserialize, JsonSchema)]
#[serde(rename_all = "lowercase")]
enum Env {
    Staging,
    Prod,
}

#[derive(Deserialize, JsonSchema)]
struct DeployInput {
    env: Env,
}

#[derive(Serialize, JsonSchema)]
struct Deployed {
    ok: bool,
}

fn describe(description: &str) -> CommandConfig {
    CommandConfig {
        description: Some(description.into()),
        ..Default::default()
    }
}

fn create_greet() -> Command {
    f::command(describe("Greet someone"))
        .input::<GreetInput>()
        .output::<Greeting>()
        .handler(|input, _| async move {
            Ok::<_, Error>(Greeting { greeting: format!("hello {}", input.name) })
        })
}

fn create_deploy() -> Command {
    f::command(describe("Deploy the app"))
        .input::<DeployInput>()
        .output::<Deployed>()
        .handler(|_, _| async move { Ok::<_, Error>(Deployed { ok: true }) })
}

fn main() -> ExitCode {
    let cli = f::program(ProgramConfig {
        name: Some("myapp".into()),
        description: Some("My CLI".into()),
        version: Some("1.0.0".into()),
        ..Default::default()
    })
    .router([("greet", create_greet().into()), ("deploy", create_deploy().into())]);
    cli.run()
}
```

`myapp greet --name world`, `myapp deploy --env prod`, `myapp --help`,
`myapp --llms` all work, and `myapp` alone prints the help. Clap adds its
own `help` subcommand too (`myapp help deploy`).

## The router key wins as the subcommand name

`.router([("greet", some_command.into())])` attaches `some_command` under
the name `"greet"` even if the leaf was built with another `name`.
Decoupling the program-level routing from each leaf's own naming makes it
easy to mount the same command twice or rename at attach time. A `Command`
is `Clone`, so mounting it twice is `("users", list.clone().into())`.

## Nesting

A route is either a `Command` (from `f::command(...)`) or a `Program`, so a
program can be a subcommand of another program:

```rust
let api = f::program(ProgramConfig {
    description: Some("API tasks".into()),
    ..Default::default()
})
.router([("greet", greet.into()), ("deploy", deploy.into())]);
let db = f::program(ProgramConfig {
    description: Some("Database tasks".into()),
    ..Default::default()
})
.router([("migrate", migrate.into()), ("seed", seed.into())]);

let cli = f::program(ProgramConfig {
    name: Some("myapp".into()),
    ..Default::default()
})
.router([("api", api.into()), ("db", db.into()), ("status", status.into())]);

// myapp api greet --name world
// myapp db migrate
// myapp status
```

`--llms` flattens the tree to space-separated tool names — the inner `greet`
becomes `"api greet"` in the manifest. See [LLMs mode](/rust/llms-mode/).

## `Command`, `Program` and `Route`

`Command` and `Program` are fireargs' own types: each compiles to a clap
command when it runs, and both have `.run()`, `.run_async()` and
`.try_run_from(...)`. `Route` is the enum of the two, with `From` impls for
both. Only fireargs commands and programs can be mounted, so every leaf has
the schemas `--llms` needs.

```rust
use fireargs::{Command, Program, Route};
```

## Aliases

`aliases: vec!["ls".into()]` on a command or nested program lets its parent
route the extra names to it too. Clap lists them in `--help` next to the
route (`[alias: ls]`), and they add no tools to `--llms`; mount the route
under a second router key when it should be a tool of its own.

## Grouping commands in help

Commands have no help groups: clap lists every route under `Commands`, in
router order. The `helpGroup` meta groups options only (see
[Inputs](/rust/inputs/#option-meta)).

## `ProgramConfig`

Same fields as [`CommandConfig`](/rust/commands/#commandconfig) minus
`json_option` — programs dispatch, they don't read JSON input. Everything
else applies: `name`, `description`, `summary`, `aliases`, `usage`,
`version`, `before_help`, `after_help`, `llms_option` and `render_error`.

Two of them reach past the program itself:

- `version` adds `-V, --version` to the program, so set it on the root.
- `render_error` set on a program covers every leaf below it that has no
  hook of its own, so one hook formats errors for the whole tree (see
  [JSON mode](/rust/json-mode/#errors)).

## Options belong to their level

Clap reads options up to the subcommand name as the program's and leaves
the rest to the subcommand, so `myapp --llms` is the program's flag and
`myapp greet --llms` the leaf's. No setting is needed for tree CLIs.

## `--help` and `--llms` per level

Each level keeps its own:

```bash
myapp --help               # top-level help, lists subcommands
myapp greet --help         # leaf-level help, lists args/options
myapp --llms               # entire tree as a flat MCP tools/list
myapp greet --llms         # just the greet leaf
```

Suppress program-level `--llms` with `llms_option: FlagConfig::Disabled` in
the program config; subcommands keep theirs.
