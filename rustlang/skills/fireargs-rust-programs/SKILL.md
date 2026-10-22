---
name: fireargs-rust-programs
description: Use when building a multi-command Rust Fireargs CLI — f::program(...).router([...]), nested programs, aliases, ProgramConfig, and sharing parameters, outputs and commands across the tree by composing serde structs.
---

# Fireargs Rust Programs

Guidance for assembling Fireargs for Rust commands into a subcommand tree and reusing pieces across it.

## When to use this skill

Invoke when the user asks to:

- Turn several commands into one binary (`myapp greet`, `myapp deploy`).
- Nest command groups (`myapp db migrate`), rename or alias a subcommand, or mount one command twice.
- Share options, output shapes or handler scaffolding between commands.

## The router

`f::program(config).router([...])` returns a `Program`; each route is a `(key, route)` pair, and `.into()` turns a `Command` or a `Program` into a `Route`:

```rust
use fireargs::{self as f, ProgramConfig};

let db = f::program(ProgramConfig {
    description: Some("Database tasks".into()),
    ..Default::default()
})
.router([("migrate", migrate.into()), ("seed", seed.into())]);

let cli = f::program(ProgramConfig {
    name: Some("myapp".into()),
    description: Some("My CLI".into()),
    version: Some("1.0.0".into()),
    ..Default::default()
})
.router([("greet", greet.into()), ("deploy", deploy.into()), ("db", db.into())]);

cli.run() // from fn main() -> ExitCode
// myapp greet world · myapp db migrate · myapp --help · myapp --llms
```

- **The router key is the subcommand name.** It overrides the command's own `name`, so `[("users", list.clone().into()), ("members", list.into())]` mounts the same leaf twice (`Command` and `Program` are `Clone`).
- **Routes are `Command` or `Program`** (the `Route` enum). Only fireargs commands mount, so every leaf has schemas for the manifest.
- **`aliases: vec!["ls".into()]`** on a command or nested program lets the parent route that name too; clap lists aliases in `--help` (`[alias: ls]`), and they add no `--llms` tools.
- `myapp` alone prints the help; clap also adds a `help` subcommand. Options before the subcommand name belong to the program, options after it to the subcommand — clap's default, no setting needed.

## `ProgramConfig`

The same fields as `CommandConfig` (see `fireargs-rust-commands`) without `json_option`: a program dispatches and takes no input, so only leaves get `--json`. `--llms` on a program prints the whole tree; `llms_option: FlagConfig::Disabled` removes it from that level only.

Two settings belong on the root program:

- `version`, which adds `-V, --version` printing `myapp 1.0.0`.
- `render_error` formats errors for every leaf below that has no hook of its own (see `fireargs-rust-automation`).

Commands have no help groups: clap lists every route under `Commands` in router order. The `helpGroup` meta groups options only.

## Composing across commands

Inputs and outputs are plain serde structs, and Fireargs config lives in each field's schema, so everything composes and the meta rides along:

```rust
/// Page size
#[derive(Clone, Copy, Deserialize, Serialize, JsonSchema)]
#[schemars(extend("fireargs" = {"kind": "option", "short": "l"}))]
struct Limit(#[schemars(range(min = 1, max = 100))] u32);

impl Default for Limit {
    fn default() -> Self {
        Limit(20)
    }
}

#[derive(Deserialize, JsonSchema)]
struct Pagination {
    #[serde(default)]
    limit: Limit,
}

#[derive(Deserialize, JsonSchema)]
struct UsersInput {
    #[serde(flatten)]
    pagination: Pagination,
    role: Option<Role>,
}

let list_users = f::command(describe("List users"))
    .input::<UsersInput>()
    .output::<Paginated<User>>()
    .handler(|input, _| async move {
        Ok::<_, Error>(paginate(fetch_users(input.role).await?, &input.pagination))
    });
```

- **Reusable fields:** newtypes such as `Limit`, carrying their doc comment, schemars attributes and meta (fireargs inlines the schema into each property). A `Default` impl gives the default; derive `Serialize` so it reaches the schema and `--help`.
- **Parameter blocks:** structs mixed in with `#[serde(flatten)]`. Their fields take the flatten's position among the struct's own — the `--help` order and the positional order. serde cannot combine `flatten` with `deny_unknown_fields`.
- **Output wrappers:** a generic struct such as `Paginated<T>`, so every list command shares one wire shape and one manifest schema.
- **Shared handler code:** plain functions such as `paginate(items, &pagination)`. Each command keeps its own small handler with concrete types.
- `.parse(...)` does not travel with a field: register it on each command's builder by key.

## Rules of thumb

1. **Name subcommands at the router.** A leaf only ever mounted needs no `name`; it only matters for a leaf run on its own.
2. **One leaf, one job.** Each leaf becomes one tool in the manifest, so a leaf switching behaviour on a mode flag is harder for an agent to call than two leaves.
3. **Describe every route.** A command's `description` is its help line and its manifest description; a program's is shown in its parent's help.
4. **Share fields as newtypes and flattened structs, not copies.** A reused block keeps `--help`, `--json` and `--llms` consistent; a copy drifts.

## Verification

- `myapp --help` and `myapp <group> --help` list every route.
- `myapp --llms` lists every leaf once per router key, named by its full path (`"db migrate"`).
- Each leaf still runs on its path with `--json '<value>'`.

## References

- Programs: https://fireargs.dev/rust/programs/
- Composability: https://fireargs.dev/rust/composability/
