---
title: Composability
path: /rust/composability/
icon: boxes
order: 9
description: Share common parameters across commands by composing structs.
---

# Composability

Inputs and outputs in fireargs are serde structs, so anything serde and
schemars can compose works here too — newtypes, `#[serde(flatten)]`,
generic structs, nested structs. Define common parameters once and reuse
them across every command that needs them, including the per-field CLI
config you attached with the `fireargs` meta.

## Reusable fields

A newtype is a field you can drop into any struct. Its doc comment, its
schemars attributes and its `fireargs` meta travel with it, since fireargs
inlines its schema into each property, and its `Default` gives the default
wherever the field is `#[serde(default)]` — derive `Serialize` too, so
schemars can write that default into the schema and `--help`:

```rust
use schemars::JsonSchema;
use serde::{Deserialize, Serialize};

/// Page number
#[derive(Clone, Copy, Deserialize, Serialize, JsonSchema)]
#[schemars(extend("fireargs" = {"kind": "option", "short": "p"}))]
struct Page(#[schemars(range(min = 1))] u32);

impl Default for Page {
    fn default() -> Self {
        Page(1)
    }
}

/// Page size
#[derive(Clone, Copy, Deserialize, Serialize, JsonSchema)]
#[schemars(extend("fireargs" = {"kind": "option", "short": "l"}))]
struct Limit(#[schemars(range(min = 1, max = 100))] u32);

impl Default for Limit {
    fn default() -> Self {
        Limit(20)
    }
}
```

A use site can still choose another default with
`#[serde(default = "...")]`. The handler reads the value as `input.limit.0`.

## Reusable parameter blocks

Group fields into a struct and mix it into each command's input with
`#[serde(flatten)]`:

```rust
#[derive(Deserialize, JsonSchema)]
struct Pagination {
    #[serde(default)]
    page: Page,
    #[serde(default)]
    limit: Limit,
}

#[derive(Deserialize, JsonSchema)]
struct Verbosity {
    /// Print more
    #[serde(default)]
    #[schemars(extend("fireargs" = {"kind": "option", "short": "v"}))]
    verbose: bool,
}
```

The meta you attached lives on the field, so when you reuse `Pagination` in
another command, `--page` / `-p` still come along for free.

## Composing into a command

```rust
use fireargs::{self as f, Command, CommandConfig, Error};

#[derive(Deserialize, Serialize, JsonSchema)]
#[serde(rename_all = "lowercase")]
enum Role {
    Admin,
    User,
}

#[derive(Serialize, JsonSchema)]
struct User {
    id: String,
    name: String,
}

#[derive(Deserialize, JsonSchema)]
struct UsersInput {
    #[serde(flatten)]
    pagination: Pagination,
    #[serde(flatten)]
    verbosity: Verbosity,
    role: Option<Role>,
}

#[derive(Serialize, JsonSchema)]
struct UsersOutput {
    users: Vec<User>,
    total: u32,
}

fn create_list_users() -> Command {
    f::command(CommandConfig {
        description: Some("List users".into()),
        ..Default::default()
    })
    .input::<UsersInput>()
    .output::<UsersOutput>()
    .handler(|_, _| async move { Ok::<_, Error>(UsersOutput { users: vec![], total: 0 }) })
}
```

A flattened block's fields take its place among the struct's own:
`UsersInput` declares `page` and `limit`, then `verbose`, then `role`. That
order is the `--help` order, and for positionals the order they are read in
— keep blocks with positionals in a deliberate place.

serde does not combine `#[serde(flatten)]` with
`#[serde(deny_unknown_fields)]`; a struct that flattens a block ignores
unknown `--json` keys.

## Reusable output blocks

Output structs compose the same way. A common pattern is a generic
"paginated response" struct:

```rust
#[derive(Serialize, JsonSchema)]
struct Paginated<T> {
    items: Vec<T>,
    total: u32,
    page: u32,
    limit: u32,
}

#[derive(Serialize, JsonSchema)]
struct Post {
    id: String,
    title: String,
}

fn create_list_posts() -> Command {
    f::command(CommandConfig {
        description: Some("List posts".into()),
        ..Default::default()
    })
    .input::<Pagination>()
    .output::<Paginated<Post>>()
    .handler(|input, _| async move {
        let (page, limit) = (input.page.0, input.limit.0);
        Ok::<_, Error>(Paginated { items: vec![], total: 0, page, limit })
    })
}
```

Every `Paginated<...>` output ends up with identical pagination metadata in
its `--llms` JSON Schema — same source of truth. The item struct is inlined
in place.

## Shared handler code

Each command keeps its own small handler with concrete types; shared
scaffolding goes into plain functions the handlers call:

```rust
fn paginate<T>(items: Vec<T>, pagination: &Pagination) -> Paginated<T> {
    let (page, limit) = (pagination.page.0, pagination.limit.0);
    let total = items.len() as u32;
    let start = ((page - 1) * limit) as usize;
    let items = items.into_iter().skip(start).take(limit as usize).collect();
    Paginated { items, total, page, limit }
}

fn create_list_members() -> Command {
    f::command(CommandConfig {
        description: Some("List members".into()),
        ..Default::default()
    })
    .input::<UsersInput>()
    .output::<Paginated<User>>()
    .handler(|input, _| async move {
        let users = vec![User { id: "1".into(), name: "Ada".into() }];
        Ok::<_, Error>(paginate(users, &input.pagination))
    })
}
```

The helper hides the boilerplate; the commands only specify what genuinely
differs.

## Programs as another composition layer

Beyond struct composition, `f::program(...)` composes _commands themselves_
into trees. Mounting the same leaf under different router keys is a valid
form of reuse:

```rust
let list_users = create_list_users();
let cli = f::program(ProgramConfig {
    name: Some("myapp".into()),
    ..Default::default()
})
.router([("users", list_users.clone().into()), ("members", list_users.into())]);
```

Both invocation paths route to the same handler. See
[Programs](/rust/programs/) for the dispatch and `--llms` flattening
details.

## What carries through

When you reuse a field or a block, every per-field detail rides along:

- **serde's and schemars' own metadata** — doc comments, defaults,
  validation attributes, `rename`, enum choices.
- **fireargs meta** — `#[schemars(extend("fireargs" = {...}))]` (name,
  short, env, conflicts, implies, hidden, preset, helpGroup,
  defaultDescription).

Both surface in clap's `--help` and in the `--llms` manifest exactly as if
you'd written the fields inline. A field's `.parse(...)` is the exception:
it is registered on each command's builder by key. Compose freely; nothing
leaks or duplicates.
