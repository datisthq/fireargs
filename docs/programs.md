---
title: Programs
path: /programs/
icon: folder-tree
order: 5
description: f.program() for subcommand trees, including nested programs.
---

# Programs

`f.program(config?)` opens a builder for a CLI tree. Pass commander-level
config, then call `.commands({ ... })` with a map of subcommands. The
terminal `.commands(...)` returns the fully-wired root commander `Command`.

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
  .commands({ greet, deploy })

cli.parseAsync(process.argv)
```

`myapp greet world`, `myapp deploy --env prod`, `myapp --help`,
`myapp --llms` all work.

## Object key wins as the subcommand name

`.commands({ greet: someCmd })` attaches `someCmd` under the name `"greet"`
even if the leaf was built with `name: "something-else"`. Decoupling the
program-level routing from each leaf's own naming makes it easy to mount
the same command twice or rename at attach time.

## Nesting

Programs and commands are both commander `Command` instances, so a program
can be a subcommand of another program:

```ts
const apiCli = f.program({ name: "api" }).commands({ greet, deploy })
const dbCli = f.program({ name: "db" }).commands({ migrate, seed })

const cli = f.program({ name: "myapp" }).commands({
  api: apiCli,
  db: dbCli,
  status: statusLeaf,
})

// myapp api greet world
// myapp db migrate
// myapp status
```

`--llms` flattens the tree to space-separated tool names — the inner
`greet` becomes `"api greet"` in the manifest. See [LLMs mode](/llms-mode/).

## `ProgramConfig`

Same shape as `CommandConfig` minus the input-side concerns: `arguments`
(no input fields at the program level) and `jsonOption` (programs dispatch —
they don't read JSON input). Otherwise everything in
[CommandConfig](/commands/#commandconfig) applies — identity (`name`,
`description`, `summary`, `aliases`, `usage`, `version`), help slots
(`helpOption`, `helpCommand`, `configureHelp`, `addHelpText`, `addHelpCommand`,
`addHelpOption`), behavior toggles, hooks, exit/output config, `on`
listeners, `executableDir`, and `llmsOption`.

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
