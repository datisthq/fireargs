---
name: fireargs-commands
description: Use when writing or editing a Fireargs command — f.command(...).input().output().render().handler(), how zod fields become arguments and --options, f.argument()/f.option() config and parse, CommandConfig, and metadata traps.
---

# Fireargs Commands

Guidance for defining a single CLI command with Fireargs: one zod input schema, one zod output schema, one handler and an optional renderer for humans.

## When to use this skill

Invoke when the user asks to:

- Add a new command or change an existing one's arguments, options or output.
- Make a field positional, give an option a short flag, an env-var fallback, choices or a default.
- Accept a shell-only syntax such as a comma list or a JSON string for one option.
- Mark options as conflicting, implied, hidden or grouped in `--help`.
- Print human-readable output, or keep a spinner quiet under `--json`.
- Customise help text, hooks, error handling, version flags or the built-in `--json` / `--llms` flags of one command.

## The builder

`f.command(config?)` opens a type-stated builder. `.input(...)`, `.output(...)` and `.handler(...)` are required, in that order; `.render(...)` is an optional step just before `.handler(...)`. `.handler(...)` returns a real commander `Command` (tagged `type: "command"`), so run it with `parseAsync`:

```ts
import { f } from "fireargs"
import { z } from "zod"

const greet = f
  .command({ name: "greet", description: "Greet someone politely." })
  .input(
    z.object({
      name: f.argument().string().describe("The user's name."),
      times: z.number().default(1).describe("Repeat it n times."),
      verbose: f.option({ short: "v" }).boolean().default(false),
    }),
  )
  .output(z.object({ greeting: z.string() }))
  .handler(input => ({ greeting: `hello ${input.name}`.repeat(input.times) }))

await greet.parseAsync(process.argv)
```

- Input must be `z.object(...)`; a command without input uses `z.object({})`. Output may be any zod schema — `z.array(...)` writes a bare JSON array — but prefer an object when the CLI is served over MCP, whose `outputSchema` must be an object.
- The handler receives the zod-parsed input and `context: { json, command }`, and may be async. Its return value is parsed through the output schema on every run, so output transforms apply and a mismatch throws.
- `context.json` is `true` under `--json`, with or without a value. Anything else written to stdout then corrupts the result: skip spinners, colors and progress output.

## Human output: `.render(...)`

Without `--json` nothing is printed unless the command has `.render((output, context) => ...)`. It receives the validated output and `context.input`; a returned string is written to `writeOut` with a newline, or it writes itself and returns nothing. It never runs under `--json`, so the handler just returns data:

```ts
f.command({ name: "list" })
  .input(z.object({ path: f.argument().string() }))
  .output(z.array(z.string()))
  .render(names => names.map(name => `- ${name}`).join("\n"))
  .handler(input => listNames(input.path))
```

## How input fields map to the CLI

Every key of the input object becomes a field, shown in kebab-case (`dryRun` → `--dry-run`, `<dry-run>`). The handler, `--json` and `--llms` keep the key itself (`dryRun`).

| Zod                | CLI                                                        |
| ------------------ | ---------------------------------------------------------- |
| bare field         | `--key <value>` option                                     |
| `f.argument()...`  | positional `<key>`, declared in input-key order            |
| `z.boolean()`      | `--key` flag, no value; `.default(true)` adds `--no-key`   |
| `z.number()`       | CLI string coerced to a number before zod parses it        |
| `z.array(T)`       | variadic: `<key...>` or `--key <value...>`                 |
| `z.enum([...])`    | choices, checked by commander before the handler runs      |
| `z.literal(...)`   | choices too, as do a union of literals and `z.enum({...})` |
| `z.tuple([A, B])`  | variadic, each value converted by its position             |
| `.default(v)`      | default shown in `--help` and applied by commander         |
| `.optional()`      | field may be absent; a positional shows as `[key]`         |
| `.describe("...")` | help text, and `description` in the `--llms` manifest      |

A boolean's `env` value is read as a word, trimmed and in any case: `1`, `true`, `yes`, `on`, `y`, `t` set it; `0`, `false`, `no`, `off`, `n`, `f` clear it, even over a `true` default; unset or empty leaves the default; anything else exits 1 with `error: option '--key' value '…' from env 'KEY' is invalid. Not a boolean.`

A number token is decimal — sign, digits, optional point and exponent, trimmed: `1e3` and `.5` parse, `0x10`, `1_000`, `inf` and `NaN` exit 1 with `… is invalid. Not a number.` A choice is the JSON text of a value (`1`, `true`, `admin`) and maps back to that value; any other token exits 1 with `error: option '--key <value>' argument 'x' is invalid. Allowed choices are a, b.`

A positional is required (`<key>`) unless its schema accepts `undefined` — `.optional()` or `.default(...)` make it `[key]`. A missing required one fails with commander's `error: missing required argument 'key'`; `--json '<value>'` and `--llms` runs need no positionals on the command line. Without a `renderError` hook, any other input that fails zod prints one commander-style `error: ...` line per field and exits 1.

## `f.argument()` and `f.option()`

Both open a field builder with `.string()`, `.number()`, `.boolean()`, `.enum([...])`, `.array(inner)` and `.schema(anyZod)`. Each returns the same zod type with Fireargs metadata attached, so `z.infer` is unchanged. Bare fields are already options — reach for `f.option()` only when a slot below is needed.

`f.option(config)`:

| Field                | Effect                                                        |
| -------------------- | ------------------------------------------------------------- |
| `name`               | long flag without dashes: `"to"` gives `--to`                 |
| `short`              | `"v"` adds `-v` alongside `--verbose`                         |
| `env`                | environment variable used when the flag is absent             |
| `conflicts`          | input key(s) of options that may not be combined with this    |
| `implies`            | `{ otherKey: value }` set when this option is given           |
| `hidden`             | leave out of `--help`                                         |
| `preset`             | value used when the flag is given alone: `--key [value]`      |
| `helpGroup`          | heading this option is listed under in `--help`               |
| `defaultDescription` | text shown for the default in `--help` instead of the literal |
| `parse`              | `(value: string) => value` for the CLI string; see below      |

`f.argument(config)` takes only `name` (shown in help and usage), `defaultDescription` and `parse`. Commander arguments have no short flag, env, conflicts, hidden or group.

## Parsing CLI strings

`parse` turns the string from argv or `env` into the field's value; zod then validates it. It never runs on `--json` input, so the schema — and the `--llms` manifest — describe the real value:

```ts
missingValues: f.option({ parse: v => v.split(",") }).schema(z.array(z.string()).optional()),
headerRows: f
  .option({ parse: v => (v === "false" ? false : v.split(",").map(Number)) })
  .schema(z.union([z.literal(false), z.array(z.number())]).optional()),
```

- A field with `parse` takes exactly one value (`--key <value>`), even for an array or boolean schema, and skips commander's choices check.
- `.schema(...)` must accept what `parse` returns, or TypeScript rejects it.
- A throw inside `parse` becomes commander's "argument … is invalid" error.

## `CommandConfig`

Everything passed to `f.command(config)` is optional and forwarded to commander:

- **Identity:** `name`, `description`, `summary`, `aliases`, `usage`, `version`, `helpGroup`; `versionOption: { flags?, description? }` renames the version flag (`"-v, --version"`).
- **Help:** `helpOption` / `helpCommand` (`false` disables), `configureHelp`, `addHelpText` (`{ beforeAll, before, after, afterAll }`), `addHelpCommand`, `addHelpOption`.
- **Parsing:** `allowUnknownOption`, `allowExcessArguments`, `enablePositionalOptions`, `passThroughOptions`, `combineFlagAndOptionalValue`, `showHelpAfterError`, `showSuggestionAfterError`.
- **Hooks and events:** `preSubcommand`, `preAction`, `postAction`, `on: [{ event, listener }]`.
- **Exit and output:** `exitOverride` (`true` throws `CommanderError` instead of exiting), `configureOutput` (`writeOut` / `writeErr`), `executableDir`.
- **Built-in flags:** `jsonOption` and `llmsOption` — `{ flags?, description? }` or `false`. See `fireargs-automation`.
- **Errors:** `renderError: (error, context) => value` turns a failed run into output and exit code 1. See `fireargs-automation`.

Anything commander supports that the config does not surface can be called on the returned `Command` directly.

## Rules of thumb

1. **Chain modifiers or nest them; both keep the metadata.** `f.option({ short: "v" }).boolean().default(false)` and `f.option({ short: "v" }).schema(z.boolean().default(false))` are the same field, and so are `.optional()`, `.nullable()` and `.describe(...)` chained after the builder.
2. **Use `parse`, not `.transform()`, for shell syntax.** A transform is part of the schema, so `--json` callers must send the same comma list or JSON string, and `--llms` shows the pre-transform type. `z.number()` needs neither: fireargs coerces its CLI string and keeps `--json` strict.
3. **Give booleans a default.** An absent flag reaches zod as `undefined`, so a required `z.boolean()` fails whenever the flag is left off. Use `z.boolean().default(false)` or `.optional()`.
4. **Expose dates as strings.** `z.date()` cannot be written to JSON Schema, so `--llms` shows it as `{}` and an agent cannot tell what to send. Use `z.iso.datetime()` (ISO string in and out) or `z.coerce.date()` on input.
5. **Write camelCase keys; set `name` only to change the flag.** `headerRows` already gives `--header-rows`. Reach for `name` for a shorter flag (`toPath` → `--to`) or to keep an existing verbatim flag (`name: "dryRun"`). A boolean defaulting to `true` gets `--no-…` to clear it, the last flag winning; a `no…` key gets none and stays a plain `--no-…` flag, `true` when passed. `conflicts` and `implies` name input keys, not flags.
6. **Order positionals required first.** They are declared in input-key order, so an optional one before a required one takes the first value. A variadic that may be empty needs `.default([])`; a bare `z.array(...)` positional requires at least one value.
7. **Wrap sparingly.** Plain zod covers descriptions, defaults, choices, variadics and optionality; the wrappers are only for commander-specific slots.

## Verification

- Run the command with `--help` and check every argument, option, default, choice and env binding is listed as intended.
- Run it once at the shell and once with `--json '<value>'`, including a case that omits each optional field. Under `--json`, stdout holds the JSON and nothing else. For a field with `parse`, the shell gets the string syntax and `--json` the parsed value.
- With `exitOverride: true` and `configureOutput: { writeOut, writeErr }` the command can be driven from a unit test without exiting the process; set on a program, both reach the leaves below.

## References

- Commands: https://fireargs.dev/typescript/commands/
- Inputs: https://fireargs.dev/typescript/inputs/
- Outputs: https://fireargs.dev/typescript/outputs/
