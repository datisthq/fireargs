---
name: fireargs-rust-programs
description: Use when building a multi-command Rust Fireargs CLI — fireargs::program() with .command(...) / .program(...), nesting, aliases, program config, and sharing options, outputs and commands via reusable #[fireargs::option] types and flattened blocks.
---

# Fireargs Rust Programs

Guidance for assembling Fireargs for Rust commands into a subcommand tree and reusing pieces across it.

## When to use this skill

Invoke when the user asks to:

- Turn several commands into one binary (`myapp greet`, `myapp deploy`).
- Nest command groups (`myapp db migrate`), rename or alias a subcommand, or mount one command twice.
- Share options, output shapes or handler scaffolding between commands.

## The router

`fireargs::program()` opens a program; `.command(key, command)` mounts a leaf and `.program(key, program)` a nested program under the subcommand name `key`:

```rust
fn db() -> fireargs::Program {
    fireargs::program()
        .description("Database tasks")
        .command("migrate", migrate())
        .command("seed", seed())
}

fn cli() -> fireargs::Program {
    fireargs::program()
        .name("myapp")
        .description("My CLI")
        .version("1.0.0")
        .command("greet", greet())
        .command("deploy", deploy())
        .program("db", db())
}

fn main() -> std::process::ExitCode {
    cli().run()
}
// myapp greet world · myapp db migrate · myapp --help · myapp --llms
```

- **The router key is the subcommand name.** It overrides the command's own `name`, so `.command("users", list.clone()).command("members", list)` mounts the same leaf twice (`Command` and `Program` are `Clone`).
- **Only fireargs commands and programs mount**, so every leaf has schemas for the manifest. A program forgets each leaf's input and output types, so one program holds commands of any types.
- **`.alias("ls")`** on a command or nested program lets the parent route that name too; clap lists aliases in `--help` (`[alias: ls]`), and they add no `--llms` tools.
- `myapp` alone prints the help; clap also adds a `help` subcommand (`myapp help greet`), never a `--llms` tool. An unknown subcommand prints `error: unknown command 'nope'` to stderr and exits 1. Options before the subcommand name belong to the program, options after it to the subcommand — clap's default, no setting needed.
- Build each piece in its own function; a CLI can also live in a `static` behind `std::sync::LazyLock`, since `Program` is `Send + Sync`.

## Program configuration

The same methods as a command's (see `fireargs-rust-commands`) without `.json_option`: a program dispatches and takes no input, so only leaves get `--json`. `--llms` on a program prints the whole tree; `.llms_option(FlagConfig::Disabled)` removes it from that level only.

Two settings belong on the root program:

- `.version(..)`, which adds `-V, --version` printing `myapp 1.0.0`.
- `.render_error(..)` formats errors for every leaf below that has no hook of its own (see `fireargs-rust-automation`).

`.configure(|clap| ..)` gets the program's declared clap command, as on a command. Commands have no help groups: clap lists every route under `Commands` in router order. The `help_group` key groups options only.

## Composing across commands

Inputs and outputs are Rust types, so a reusable argument or option is a type, a reusable group of them is a flattened struct, and a reusable output shape is a generic struct:

```rust
/// Page size
#[fireargs::option(short = 'l', default = 20)]
struct Limit(#[fireargs(range(min = 1, max = 100))] u32);

#[fireargs::option]
enum Role {
    Admin,
    User,
}

#[fireargs::input]
struct Pagination {
    limit: Limit,
}

#[fireargs::input]
struct UsersInput {
    #[fireargs(flatten)]
    pagination: Pagination,
    role: Option<Role>,
}

#[fireargs::output]
struct Paginated<T> {
    items: Vec<T>,
    total: u32,
}

fn paginate<T>(items: Vec<T>, pagination: &Pagination) -> Paginated<T> {
    let total = items.len() as u32;
    let items = items.into_iter().take(*pagination.limit as usize).collect();
    Paginated { items, total }
}

fn list_users() -> fireargs::Command<UsersInput, Paginated<User>> {
    fireargs::command()
        .description("List users")
        .handler(async |input: UsersInput, _| {
            Ok(paginate(fetch_users(input.role).await?, &input.pagination))
        })
}
```

- **Reusable fields:** `#[fireargs::option(...)]` and `#[fireargs::argument(...)]` newtypes — the twins of `f.option()` / `f.argument()` — carrying their doc comment, validation (`#[fireargs(range(..))]` on the inner field), CLI config (`short`, `env`, …), `default` and `parse`. `Deref` reads the value: `*input.limit`. A field of such a type with a default is optional.
- **Overriding at the use site:** `#[fireargs(short = 'b')]` on a field of a reusable type overrides that key and keeps the type's others; a doc comment on the field replaces its description.
- **Choices:** `#[fireargs::option]` (or `argument`) on an enum, kebab-case on the wire (`"admin"`).
- **Parameter blocks:** `#[fireargs::input]` structs mixed in with `#[fireargs(flatten)]`. Their fields take the flatten's position among the struct's own — the `--help` order and the positional order — and bring their `parse` functions along. serde cannot combine `flatten` with `deny_unknown_fields`.
- **Output wrappers:** a generic `#[fireargs::output]` struct such as `Paginated<T>`, so every list command shares one wire shape and one manifest schema.
- **Shared handler code:** plain functions such as `paginate(items, &pagination)`. Each command keeps its own small handler with concrete types.
- `conflicts` and `implies` name sibling fields, so they stay on fields, not on reusable types.

## Rules of thumb

1. **Name subcommands at the router.** A leaf only ever mounted needs no `name`; it only matters for a leaf run on its own.
2. **One leaf, one job.** Each leaf becomes one tool in the manifest, so a leaf switching behaviour on a mode flag is harder for an agent to call than two leaves.
3. **Describe every route.** A command's `description` is its help line and its manifest description; a program's is shown in its parent's help.
4. **Share fields as `#[fireargs::option]` / `#[fireargs::argument]` types and flattened blocks, not copies.** A reused block keeps `--help`, `--json` and `--llms` consistent; a copy drifts.

## Verification

- `myapp --help` and `myapp <group> --help` list every route.
- `myapp --llms` lists every leaf once per router key, named by its full path (`"db migrate"`).
- Each leaf still runs on its path with `--json '<value>'`.

## References

- Programs: https://fireargs.dev/rust/programs/
- Composability: https://fireargs.dev/rust/composability/
