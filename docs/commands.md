---
title: Commands
path: /commands/
icon: terminal
order: 2
description: The f.command(...) chainable builder and the leaf shape it produces.
---

# Commands

`f.command(config?)` opens a chainable, type-stated builder. Call `.input(...)`,
`.output(...)`, then `.handler(...)` — each step is required, in that order.
The terminal `.handler(...)` returns a fully-wired commander `Command`.

```ts
import { f } from "fireargs"
import { z } from "zod"

const greet = f
  .command({ name: "greet" })
  .input(z.object({ name: z.string() }))
  .output(z.object({ greeting: z.string() }))
  .handler(input => ({ greeting: `hello ${input.name}` }))

await greet.parseAsync(process.argv)
```

## `.input(z.object)` and `.output(z.object)`

Both must be `z.object(...)` schemas. The input shape determines the
positional arguments and `--options` (see [Inputs](/inputs/)). The output
schema validates whatever the handler returns; mismatches throw at runtime
through commander's `parseAsync`.

## `.handler((input) => result)`

Receives the parsed, zod-validated input as a single positional argument.
Must return a value matching the output schema. May be async — fireargs
awaits it.

The handler is wrapped in commander's `.action(...)`. Errors propagate via
the returned `Command`'s `parseAsync(...)` — set `exitOverride: true` in the
config to surface them as exceptions instead of `process.exit`.

## What gets derived from the input schema

For each property of the input object schema:

| Zod construct               | Becomes                                                                           |
| --------------------------- | --------------------------------------------------------------------------------- |
| `z.string()` / `z.number()` | `--key <value>` (mandatory unless wrapped)                                        |
| `z.boolean()`               | `--key` flag (boolean)                                                            |
| `z.optional(...)`           | optional positional `[key]` if marked `f.argument()`                              |
| `z.default(v)`              | forwarded to commander as `defaultValue`                                          |
| `z.enum([...])`             | `cmd.choices([...])` on the option/argument                                       |
| `z.array(T)`                | variadic — `<key...>` for positional, `--key <value...>` for option               |
| `z.array(z.enum([...]))`    | variadic with choices on the element                                              |
| `.describe("...")`          | shown in commander `--help` and surfaced as `description` in `--llms` JSON Schema |

For per-field commander config that zod doesn't model (short flag, env var,
conflicts, hidden, preset, …) wrap the field with [`f.argument(config)`
or `f.option(config)`](/inputs/).

## `CommandConfig`

The config passed to `f.command(config?)` is a thin pass-through to
commander methods. All fields are optional.

| Field                                                                                                                        | Maps to                                                                                            |
| ---------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| `name`                                                                                                                       | `cmd.name(...)`                                                                                    |
| `description`, `summary`, `aliases`, `usage`, `version`                                                                      | identity setters                                                                                   |
| `helpOption`, `helpCommand`                                                                                                  | `cmd.helpOption(...)`, `cmd.helpCommand(...)`; `false` to disable                                  |
| `configureHelp`                                                                                                              | `cmd.configureHelp(...)` — `Partial<commander.Help>`                                               |
| `addHelpText`                                                                                                                | `{ beforeAll?, before?, after?, afterAll? }` — each forwarded to `cmd.addHelpText(position, text)` |
| `addHelpCommand`, `addHelpOption`                                                                                            | drop a pre-built commander `Command` / `Option` instance into help slots                           |
| `preSubcommand`, `preAction`, `postAction`                                                                                   | each becomes `cmd.hook(event, fn)`                                                                 |
| `allowUnknownOption`, `allowExcessArguments`, `enablePositionalOptions`, `passThroughOptions`, `combineFlagAndOptionalValue` | matching boolean toggles                                                                           |
| `showHelpAfterError`, `showSuggestionAfterError`                                                                             | matching setters                                                                                   |
| `exitOverride`                                                                                                               | `true` enables throw mode; pass a `(err) => void` for a custom handler                             |
| `configureOutput`                                                                                                            | `cmd.configureOutput({...})` — custom `writeOut`/`writeErr`/etc.                                   |
| `executableDir`                                                                                                              | `cmd.executableDir(path)`                                                                          |
| `on`                                                                                                                         | `Array<{ event, listener }>` — each registered via `cmd.on(event, listener)`                       |
| `jsonOption`, `llmsOption`                                                                                                   | customize or disable the built-in `--json`/`--llms` flags. See [LLM mode](/llm-mode/)              |

Anything commander supports that fireargs hasn't surfaced (yet) you can call
directly on the returned `Command` — `.handler(...)` returns a real commander
instance.

## Why fixed-order pipeline?

`.input` then `.output` then `.handler`, all required, no shortcuts. This
keeps the type-state simple (three small interfaces, each exposing one
method) and makes the `Command`'s static type predictable. If you find
yourself wanting an inputless command, use `z.object({})`.
