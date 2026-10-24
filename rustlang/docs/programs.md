---
title: Programs
path: /rust/programs/
icon: folder-tree
order: 6
description: fireargs::program() for subcommand trees, including nested programs.
---

# Programs

`fireargs::program()` builds a CLI tree: `.command(key, command)` mounts a leaf and
`.program(key, program)` a nested program, each under the subcommand name `key`. The
configuration methods are a command's (see [Configuration](#configuration)).

```rust
#[fireargs::input]
struct GreetInput {
    name: String,
}

#[fireargs::output]
struct GreetOutput {
    greeting: String,
}

#[fireargs::option]
enum Env {
    Staging,
    Prod,
}

#[fireargs::input]
struct DeployInput {
    env: Env,
}

#[fireargs::output]
struct Deployed {
    ok: bool,
}

fn greet() -> fireargs::Command<GreetInput, GreetOutput> {
    fireargs::command()
        .description("Greet someone")
        .handler(async |input: GreetInput, _| {
            Ok(GreetOutput { greeting: format!("hello {}", input.name) })
        })
}

fn deploy() -> fireargs::Command<DeployInput, Deployed> {
    fireargs::command()
        .description("Deploy the app")
        .handler(async |_: DeployInput, _| Ok(Deployed { ok: true }))
}

fn cli() -> fireargs::Program {
    fireargs::program()
        .name("myapp")
        .description("My CLI")
        .version("1.0.0")
        .command("greet", greet())
        .command("deploy", deploy())
}

fn main() -> std::process::ExitCode {
    cli().run()
}
```

`myapp greet --name world`, `myapp deploy --env prod`, `myapp --help`,
`myapp --llms` all work, and `myapp` alone prints the help. Clap adds its
own `help` subcommand too (`myapp help deploy`).

## The router key wins as the subcommand name

`.command("greet", some_command)` attaches `some_command` under the name `"greet"`
even if the leaf was built with another `name`. Decoupling the program-level routing
from each leaf's own naming makes it easy to mount the same command twice or rename
at attach time. A `Command` is `Clone`, so mounting it twice is
`.command("users", list.clone()).command("members", list)`.

## Nesting

`.program(key, program)` mounts a program as a subcommand of another:

```rust
fn api() -> fireargs::Program {
    fireargs::program()
        .description("API tasks")
        .command("greet", greet())
        .command("deploy", deploy())
}

fn db() -> fireargs::Program {
    fireargs::program()
        .description("Database tasks")
        .command("migrate", migrate())
        .command("seed", seed())
}

fn cli() -> fireargs::Program {
    fireargs::program()
        .name("myapp")
        .program("api", api())
        .program("db", db())
        .command("status", status())
}

// myapp api greet --name world
// myapp db migrate
// myapp status
```

`--llms` flattens the tree to space-separated tool names — the inner `greet`
becomes `"api greet"` in the manifest. See [LLMs mode](/rust/llms-mode/).

## `Command` and `Program`

`Command<I, O>` and `Program` are fireargs' own types: each compiles to a clap
command when it runs, and both have `.run()`, `.run_async()` and
`.try_run_from(...)`. Only fireargs commands and programs can be mounted, so every
leaf has the schemas `--llms` needs. A program forgets its leaves' input and output
types when it mounts them, so one program holds commands of any types. Both are
`Clone + Send + Sync`, so a CLI can also live in a `static` behind
`std::sync::LazyLock`.

## Aliases

`.alias("ls")` on a command or nested program lets its parent route the extra name
to it too; repeat it for more. Clap lists them in `--help` next to the
route (`[alias: ls]`), and they add no tools to `--llms`; mount the route
under a second router key when it should be a tool of its own.

## Grouping commands in help

Commands have no help groups: clap lists every route under `Commands`, in
router order. The `help_group` key groups options only (see
[Inputs](/rust/inputs/#option-keys)).

## Configuration

The same methods as a [command](/rust/commands/#configuration) minus `.json_option`
— programs dispatch, they don't read JSON input. Everything else applies: `.name`,
`.description`, `.summary`, `.alias`, `.usage`, `.version`, `.before_help`,
`.after_help`, `.llms_option`, `.render_error` and `.configure`.

Two of them reach past the program itself:

- `.version(...)` adds `-V, --version` to the program, so set it on the root.
- `.render_error(...)` on a program covers every leaf below it that has no hook of
  its own, so one hook formats errors for the whole tree (see
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

Suppress program-level `--llms` with `.llms_option(FlagConfig::Disabled)` on the
program; subcommands keep theirs.
