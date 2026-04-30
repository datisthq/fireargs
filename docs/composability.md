---
title: Composability
path: /composability/
icon: boxes
order: 8
description: Share common parameters across commands by composing zod schemas.
---

# Composability

Inputs and outputs in fireargs are zod object schemas, so anything zod can
compose works here too — `.extend()`, `.merge()`, shape spread,
discriminated unions. Define common parameters once and reuse them across
every command that needs them, including the per-field commander config you
attached via `f.argument()` / `f.option()`.

## Reusable parameter blocks

Build a zod object once, then mix it into each command's input:

```ts
import { f } from "fireargs"
import { z } from "zod"

const paginationParams = z.object({
  page: f
    .option({ short: "p" })
    .schema(z.coerce.number().int().min(1).default(1)),
  limit: f
    .option({ short: "l" })
    .schema(z.coerce.number().int().min(1).max(100).default(20)),
})

const verbosityParams = z.object({
  verbose: f.option({ short: "v" }).boolean(),
  quiet: f.option({ short: "q" }).boolean(),
})
```

The metadata you attached with `f.option(...)` lives on the schema, so when
you reuse `paginationParams` in another command, `--page` / `-p` still come
along for free.

## Composing into a command

Three equivalent shapes — pick whichever reads cleanly for the call site.

### Shape spread (most flexible)

```ts
const listUsers = f
  .command({ name: "users", description: "List users" })
  .input(
    z.object({
      ...paginationParams.shape,
      ...verbosityParams.shape,
      role: z.enum(["admin", "user"]).optional(),
    }),
  )
  .output(z.object({ users: z.array(userSchema), total: z.number() }))
  .handler(input => ({ users: [], total: 0 }))
```

### `.extend(...)` from a base

```ts
const baseParams = z.object({
  ...paginationParams.shape,
  ...verbosityParams.shape,
})

const listPosts = f
  .command({ name: "posts" })
  .input(baseParams.extend({ author: z.string().optional() }))
  .output(z.object({ posts: z.array(postSchema), total: z.number() }))
  .handler(input => ({ posts: [], total: 0 }))
```

### `.merge(...)` of two objects

```ts
const filterParams = z.object({ since: z.iso.datetime().optional() })

const listEvents = f
  .command({ name: "events" })
  .input(paginationParams.merge(filterParams))
  .output(z.object({ events: z.array(eventSchema) }))
  .handler(input => ({ events: [] }))
```

## Reusable output blocks

Output schemas compose the same way. A common pattern is a generic
"paginated response" wrapper:

```ts
function paginated<T extends z.ZodType>(item: T) {
  return z.object({
    items: z.array(item),
    total: z.number(),
    page: z.number(),
    limit: z.number(),
  })
}

const userOutput = paginated(z.object({ id: z.string(), name: z.string() }))
const postOutput = paginated(z.object({ id: z.string(), title: z.string() }))
```

Both `userOutput` and `postOutput` end up with identical pagination
metadata in their `--llms` JSON Schemas — same source of truth.

## Command factories

If many commands share more than just inputs — e.g. they all return a
paginated list with the same handler scaffolding — encapsulate the pattern
in a factory that returns a partially-built command builder:

```ts
function listCommand<T extends z.ZodObject>(
  config: Parameters<typeof f.command>[0],
  itemSchema: T,
) {
  return f
    .command(config)
    .input(
      z.object({
        ...paginationParams.shape,
        ...verbosityParams.shape,
      }),
    )
    .output(paginated(itemSchema))
}

const listUsers = listCommand(
  { name: "users", description: "List users" },
  z.object({ id: z.string(), name: z.string() }),
).handler(input => ({
  items: [],
  total: 0,
  page: input.page,
  limit: input.limit,
}))

const listPosts = listCommand(
  { name: "posts" },
  z.object({ id: z.string(), title: z.string() }),
).handler(input => ({
  items: [],
  total: 0,
  page: input.page,
  limit: input.limit,
}))
```

The factory hides the boilerplate; the call sites only specify what
genuinely differs.

## Programs as another composition layer

Beyond schema composition, `f.program(...)` composes _commands themselves_
into trees. Mounting the same leaf under different program keys is a valid
form of reuse:

```ts
const cli = f.program({ name: "myapp" }).commands({
  users: listUsers,
  members: listUsers,
})
```

Both invocation paths route to the same handler. See
[Programs](/programs/) for the dispatch and `--llms` flattening details.

## What carries through

When you reuse a fragment, every per-field detail rides along:

- **Zod's own metadata** — `.describe()`, `.default()`, `.optional()`,
  `.enum()`, `.coerce`, validation rules.
- **fireargs metadata** — `f.argument()` / `f.option()` config (short,
  env, conflicts, hidden, preset, helpGroup, defaultDescription).

Both surface in commander's `--help` and in the `--llms` manifest exactly
as if you'd written the fields inline. Compose freely; nothing leaks or
duplicates.
