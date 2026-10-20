---
name: fireargs-programs
description: Use when building a multi-command Fireargs CLI — f.program(...).router(...), nested programs, help groups, ProgramConfig, and sharing parameters, outputs and whole commands across the tree by composing zod schemas.
---

# Fireargs Programs

Guidance for assembling Fireargs commands into a subcommand tree and reusing pieces across it.

## When to use this skill

Invoke when the user asks to:

- Turn several commands into one binary (`myapp greet`, `myapp deploy`).
- Nest command groups (`myapp db migrate`), rename or alias a subcommand, or mount one command twice.
- Group subcommands under headings in `--help`.
- Share options, output shapes or command scaffolding between commands.

## The router

`f.program(config?).router(routes)` returns a `Program`, a commander `Command` tagged `type: "program"`:

```ts
import { f } from "fireargs"

const db = f.program({ description: "Database tasks" }).router({ migrate, seed })

const cli = f
  .program({ name: "myapp", description: "My CLI", version: "1.0.0" })
  .router({ greet, deploy, db })

await cli.parseAsync(process.argv)
// myapp greet world · myapp db migrate · myapp --help · myapp --llms
```

- **The router key is the subcommand name.** It overrides any `name` the command was built with, so `{ users: listUsers, members: listUsers }` mounts the same leaf twice.
- **Routes are `Command | Program`** (exported as the `Route` type). A raw commander `Command` is rejected at compile time: it has no schemas to put in the manifest.
- Build every leaf with `f.command(...)` and every group with `f.program(...)`, then attach. Import the types with `import type { Command, Program, Route } from "fireargs"`; alias commander's own `Command` if both are needed.

## `ProgramConfig`

The same fields as `CommandConfig` (see `fireargs-commands`) without `jsonOption`: a program dispatches and takes no input, so only leaves get `--json`. Two program-specific behaviours:

- `enablePositionalOptions` defaults to `true`, so options before a subcommand belong to the program and options after it belong to the subcommand. Without it, `myapp greet --llms` would be read as the program's `--llms`. Pass `false` only for commander's legacy parsing.
- `--llms` on a program prints the whole tree; `llmsOption: false` removes it from that level only.

Two settings belong on the root program:

- `version` plus `versionOption: { flags: "-v, --version" }` for a short version flag.
- `renderError` formats errors for every leaf below that has no hook of its own (see `fireargs-automation`).

## Help groups

Set `helpGroup` on a command's or nested program's config to list it under its own heading in the parent's `--help`. Routes without one stay under `Commands:`; headings appear in the order their first route does. `f.option({ helpGroup })` does the same for options.

```ts
const deploy = f.command({ description: "Deploy", helpGroup: "Ops:" }) // ...
const users = f
  .program({ description: "Manage users", helpGroup: "Ops:" })
  .router({ list })
f.program({ name: "myapp" }).router({ deploy, users, version })
```

## Composing across commands

Inputs and outputs are plain zod objects, and Fireargs metadata lives on each field schema, so everything composes and the `f.option(...)` config rides along:

```ts
const pagination = z.object({
  page: f.option({ short: "p" }).schema(z.number().int().min(1).default(1)),
  limit: f.option({ short: "l" }).schema(z.number().int().max(100).default(20)),
})

const listUsers = f
  .command({ description: "List users" })
  .input(z.object({ ...pagination.shape, role: z.enum(["admin", "user"]).optional() }))
  .output(paginated(userSchema))
  .handler(input => ({ items: [], total: 0, page: input.page, limit: input.limit }))
```

- **Parameter blocks:** shape spread (`...block.shape`), `base.extend({...})` or `a.merge(b)`.
- **Output wrappers:** a function such as `paginated(item)` returning a `z.object`, so every list command shares one wire shape and one manifest schema.
- **Command factories:** a function returning `f.command(config).input(...).output(...)`, leaving each call site only `.handler(...)`.

## Rules of thumb

1. **Name subcommands at the router.** Leave `name` off leaves that are only ever mounted; set it only on a leaf run on its own.
2. **One leaf, one job.** Each leaf becomes one tool in the manifest, so a leaf switching behaviour on a mode flag is harder for an agent to call than two leaves.
3. **Describe every route.** A command's `description` is its help line and its manifest description; a program's is shown in its parent's help.
4. **Share fields as zod, not as copies.** A reused block keeps `--help`, `--json` and `--llms` consistent; a copy drifts.

## Verification

- `myapp --help` and `myapp <group> --help` list every route, under the intended headings.
- `myapp --llms` lists every leaf once, named by its full path (`"db migrate"`).
- Each leaf still runs on its path with `--json '<value>'`.

## References

- Programs: https://fireargs.dev/typescript/programs/
- Composability: https://fireargs.dev/typescript/composability/
