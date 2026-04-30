---
title: JSON mode
path: /json-mode/
icon: file-json
order: 5
description: --json drives a fireargs command with JSON in and JSON out.
---

# JSON mode

`--json` is a built-in flag on every fireargs command. It lets the same
binary serve human users at the shell, scripts in a pipeline, and LLM
agents — all backed by one zod-validated handler.

Enabled by default. Disable per-command with `jsonOption: false`, or
customize the flag string/description with `jsonOption: { flags?, description? }`.

## Three modes

```bash
greet world                              # CLI in, no output (default behavior)
greet world --json                       # CLI in, JSON out
greet --json '{"name":"world"}'          # JSON in, JSON out
```

The flag takes an optional value (`--json [value]`):

- **Absent** — normal CLI parsing, handler runs, no automatic output.
- **Present without a value** — CLI parsing for input, but the handler's
  return is serialized as JSON to stdout.
- **Present with a JSON value** — input comes from the JSON blob; CLI
  positionals/options are skipped; output is JSON.

## What happens on `--json '<value>'`

1. `JSON.parse`'s the value.
2. Validates the parsed object through the input zod schema.
3. Calls the handler with the validated input.
4. Validates the handler's return through the output schema.
5. Writes `JSON.stringify(result, null, 2) + "\n"` to commander's
   `writeOut` — `configureOutput.writeOut` can intercept it (handy for
   tests).

When `--json` is passed alone (no value), step 1 is skipped and input is
collected from the regular CLI parse instead. Steps 3–5 are identical.

## Errors

Zod validation failures (input or output) and commander parse errors are
written to stderr and propagate via the returned `Command`'s
`parseAsync(...)`. With `exitOverride: true` they surface as exceptions
instead of `process.exit(1)`.

## Composes with subcommands

Every leaf in a program tree gets its own `--json`:

```bash
myapp greet --json '{"name":"world"}'
myapp api deploy --json '{"env":"prod"}'
```

The program (root) doesn't have its own `--json` — programs dispatch to
subcommands; only leaves take input. See [Programs](/programs/).

## Pairs with `--llms`

Together with [LLMs mode](/llms-mode/), `--json` is the call-time half of
fireargs's agentic interface: an LLM reads the `--llms` manifest to learn
the schemas, then calls back through `--json` with a value matching the
documented `inputSchema`.
