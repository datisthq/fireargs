---
title: Composability
path: /rust/composability/
icon: boxes
order: 10
description: Share arguments, options and parameter blocks across commands with reusable types and flattened structs.
---

# Composability

Inputs and outputs in fireargs are Rust types, so reuse is the Rust kind: a reusable
argument or option is a type, a reusable group of them is a struct you flatten in,
and a reusable output shape is a generic struct. Define common parameters once and
reuse them across every command that needs them, CLI config included.

## Reusable arguments and options

`#[fireargs::option(...)]` on a newtype makes an option you can drop into any input,
and `#[fireargs::argument(...)]` a positional — the twins of TypeScript's
`f.option()` / `f.argument()` and Python's `Option` / `Argument`. The type's doc
comment, its validation keys and its CLI config travel with it, and so do its
`default` and `parse`:

```rust
/// Page number
#[fireargs::option(short = 'p', default = 1)]
struct Page(#[fireargs(range(min = 1))] u32);

/// Page size
#[fireargs::option(short = 'l', default = 20)]
struct Limit(#[fireargs(range(min = 1, max = 100))] u32);

/// Who to greet
#[fireargs::argument]
struct Name(String);
```

The macro adds the serde and schemars derives, `Default` from `default`, `From` the
inner value, and `Deref` to it, so the handler reads `*input.limit`. A field of such a
type is optional when the type has a default, as if it were `#[fireargs(default)]`.
The field still names the flag: `limit: Limit` is `--limit`, `name: Name` is `[name]`.

Both take the field keys that make sense for a type: `name`, `short`, `env`, `hidden`,
`preset`, `help_group`, `default_description`, `default` and `parse`. `conflicts` and
`implies` name sibling fields, so they stay on the field.

On an enum, either macro gives a set of choices, kebab-case on the wire
(`Role::Admin` is `"admin"`) unless a `#[serde(rename_all = "...")]` says otherwise:

```rust
#[fireargs::option]
enum Role {
    Admin,
    User,
}
```

## Overriding at the use site

`#[fireargs(...)]` on a field of a reusable type overrides the type's keys one by one
and keeps the rest — `#[fireargs(option)]` even makes an argument type an option there;
a doc comment on the field replaces the type's description:

```rust
#[fireargs::input]
struct SearchInput {
    limit: Limit, // -l, --limit, "Page size", default 20
    /// Results per batch
    #[fireargs(short = 'b')]
    batch: Limit, // -b, --batch, "Results per batch", default 20
}
```

## Reusable parameter blocks

Group fields into a `#[fireargs::input]` struct and mix it into each command's input
with `#[fireargs(flatten)]`:

```rust
#[fireargs::input]
struct Pagination {
    page: Page,
    limit: Limit,
}

#[fireargs::input]
struct Verbosity {
    /// Print more
    #[fireargs(short = 'v', default)]
    verbose: bool,
}
```

The config lives on each field, so when you reuse `Pagination` in another command,
`--page` / `-p` still come along for free, and so do the `parse` functions of its
fields.

## Composing into a command

```rust
#[fireargs::output]
struct User {
    id: String,
    name: String,
}

#[fireargs::input]
struct UsersInput {
    #[fireargs(flatten)]
    pagination: Pagination,
    #[fireargs(flatten)]
    verbosity: Verbosity,
    role: Option<Role>,
}

#[fireargs::output]
struct UsersOutput {
    users: Vec<User>,
    total: u32,
}

fn list_users() -> fireargs::Command<UsersInput, UsersOutput> {
    fireargs::command()
        .description("List users")
        .handler(async |_: UsersInput, _| Ok(UsersOutput { users: vec![], total: 0 }))
}
```

A flattened block's fields take its place among the struct's own: `UsersInput`
declares `page` and `limit`, then `verbose`, then `role`. That order is the `--help`
order, and for positionals the order they are read in — keep blocks with positionals
in a deliberate place.

serde does not combine `#[serde(flatten)]` with `#[serde(deny_unknown_fields)]`; a
struct that flattens a block ignores unknown `--json` keys.

## Reusable output blocks

Output structs compose the same way. A common pattern is a generic "paginated
response" struct:

```rust
#[fireargs::output]
struct Paginated<T> {
    items: Vec<T>,
    total: u32,
    page: u32,
    limit: u32,
}

#[fireargs::output]
struct Post {
    id: String,
    title: String,
}

fn list_posts() -> fireargs::Command<Pagination, Paginated<Post>> {
    fireargs::command()
        .description("List posts")
        .handler(async |input: Pagination, _| {
            let (page, limit) = (*input.page, *input.limit);
            Ok(Paginated { items: vec![], total: 0, page, limit })
        })
}
```

Every `Paginated<...>` output ends up with identical pagination metadata in its
`--llms` JSON Schema — same source of truth. The item struct is inlined in place.

## Shared handler code

Each command keeps its own small handler with concrete types; shared scaffolding
goes into plain functions the handlers call:

```rust
fn paginate<T>(items: Vec<T>, pagination: &Pagination) -> Paginated<T> {
    let (page, limit) = (*pagination.page, *pagination.limit);
    let total = items.len() as u32;
    let start = ((page - 1) * limit) as usize;
    let items = items.into_iter().skip(start).take(limit as usize).collect();
    Paginated { items, total, page, limit }
}

fn list_members() -> fireargs::Command<UsersInput, Paginated<User>> {
    fireargs::command()
        .description("List members")
        .handler(async |input: UsersInput, _| {
            let users = vec![User { id: "1".into(), name: "Ada".into() }];
            Ok(paginate(users, &input.pagination))
        })
}
```

The helper hides the boilerplate; the commands only specify what genuinely differs.

## Programs as another composition layer

Beyond type composition, `fireargs::program()` composes _commands themselves_ into
trees. Mounting the same leaf under different router keys is a valid form of reuse:

```rust
fn cli() -> fireargs::Program {
    let users = list_users();
    fireargs::program()
        .name("myapp")
        .command("users", users.clone())
        .command("members", users)
}
```

Both invocation paths route to the same handler. See [Programs](/rust/programs/) for
the dispatch and `--llms` flattening details.

## What carries through

When you reuse a type or a block, every per-field detail rides along:

- **The type's own metadata** — doc comments, validation keys, `rename`, enum
  choices.
- **CLI config** — `name`, `short`, `env`, `hidden`, `preset`, `help_group`,
  `default_description`, and on fields `conflicts` and `implies`.
- **`default` and `parse`** — a reusable type's default makes its fields optional, and
  its `parse` reads their CLI strings.

All of it surfaces in clap's `--help` and in the `--llms` manifest exactly as if
you'd written the fields inline. Compose freely; nothing leaks or duplicates.
