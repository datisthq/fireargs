---
title: Programs
path: /typescript/programs/
icon: folder-tree
order: 6
description: f.program() for subcommand trees, including nested programs.
---

# Programs

`f.program(config?)` opens a builder for a CLI tree. Pass commander-level
config, then call `.router({ ... })` with a map of commands and nested
programs. The terminal `.router(...)` returns the fully-wired `Program`.

```ts
import { f } from "fireargs"
import { z } from "zod"

const greet = f
  .command({ name: "greet" })
  .input(z.object({ name: z.string() }))
  .output(z.object({ greeting: z.string() }))
  .handler(input => ({ greeting: `hello ${input.name}` }))

const deploy = f
  .command({ name: "deploy" })
  .input(z.object({ env: z.enum(["staging", "prod"]) }))
  .output(z.object({ ok: z.boolean() }))
  .handler(() => ({ ok: true }))

const cli = f
  .program({ name: "myapp", description: "My CLI", version: "1.0.0" })
  .router({ greet, deploy })

cli.parseAsync(process.argv)
```

`myapp greet world`, `myapp deploy --env prod`, `myapp --help`,
`myapp --llms` all work.

## Object key wins as the subcommand name

`.router({ greet: someCmd })` attaches `someCmd` under the name `"greet"`
even if the leaf was built with `name: "something-else"`. Decoupling the
program-level routing from each leaf's own naming makes it easy to mount
the same command twice or rename at attach time.

## Nesting

`.router(...)` takes a `Route`, which is either a `Command` (from `.handler(...)`)
or a `Program` (from `.router(...)`), so a program can be a subcommand of
another program:

```ts
const apiCli = f.program({ name: "api" }).router({ greet, deploy })
const dbCli = f.program({ name: "db" }).router({ migrate, seed })

const cli = f.program({ name: "myapp" }).router({
  api: apiCli,
  db: dbCli,
  status: statusLeaf,
})

// myapp api greet world
// myapp db migrate
// myapp status
```

`--llms` flattens the tree to space-separated tool names — the inner
`greet` becomes `"api greet"` in the manifest. See [LLMs mode](/typescript/llms-mode/).

## `Command`, `Program` and `Route`

Both are subclasses of commander's `Command`, so `parseAsync`, `--help`
and the rest of commander work unchanged. Each carries a `type` field —
`"command"` or `"program"` — that keeps them apart in the type system, and
`Route` is their union. A raw commander `Command` isn't a `Route`: without
fireargs' schemas it would be missing from `--llms`, so `.router(...)`
rejects it at compile time.

```ts
import type { Command, Program, Route } from "fireargs"
import { Command as CommanderCommand } from "commander" // alias on clash
```

## Grouping commands in help

Set `helpGroup` on a command or a nested program to list it under its own
heading in the parent's `--help`, the same way `f.option({ helpGroup })`
groups options. Routes without one stay under `Commands:`, and headings
print in the order their first route appears.

```ts
const deploy = f.command({ description: "Deploy", helpGroup: "Ops:" }) // ...
const users = f.program({ description: "Manage users", helpGroup: "Ops:" }).router({ list })

f.program({ name: "myapp" }).router({ deploy, users, version })
// Ops:
//   deploy [options]   Deploy
//   users [options]    Manage users
//
// Commands:
//   version [options]  Print version
```

## `ProgramConfig`

Same shape as `CommandConfig` minus the input-side concerns: `arguments`
(no input fields at the program level) and `jsonOption` (programs dispatch —
they don't read JSON input). Otherwise everything in
[CommandConfig](/typescript/commands/#commandconfig) applies — identity (`name`,
`description`, `summary`, `aliases`, `usage`, `version`, `helpGroup`), help
slots (`helpOption`, `helpCommand`, `configureHelp`, `addHelpText`,
`addHelpCommand`, `addHelpOption`), behavior toggles, hooks, exit/output
config, `on` listeners, `executableDir`, and `llmsOption`.

Two of them reach past the program itself:

- `version` with `versionOption: { flags: "-v, --version" }` keeps a short
  version flag.
- `renderError` set on a program covers every leaf below it that has no hook
  of its own, so one hook formats errors for the whole tree (see
  [JSON mode](/typescript/json-mode/#errors)).

## `enablePositionalOptions` defaults to `true` on programs

Without it, a program-level option like `--llms` would shadow a subcommand's
`--llms` (commander would parse `--llms` against the program no matter where
it appears in argv). With positional options on, options before the
subcommand belong to the program and options after belong to the subcommand
— exactly what you want for tree CLIs. Override by passing
`enablePositionalOptions: false` if you specifically need the legacy
behavior.

## `--help` and `--llms` per level

Each level keeps its own:

```bash
myapp --help               # top-level help, lists subcommands
myapp greet --help         # leaf-level help, lists args/options
myapp --llms               # entire tree as a flat MCP tools/list
myapp greet --llms         # just the greet leaf
```

Suppress program-level `--llms` with `llmsOption: false` in the program
config; subcommands keep theirs.
