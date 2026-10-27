---
title: JSON mode
path: /python/json-mode/
icon: file-braces
order: 8
description: --json drives a fireargs command with JSON in and JSON out.
---

# JSON mode

`--json` is a built-in flag on every fireargs command. It lets the same
program serve human users at the shell, scripts in a pipeline, and LLM
agents — all backed by one pydantic-validated handler.

Enabled by default. Disable per command with `json_option=False`, or
customize the flag and its help with
`json_option={"flags": ..., "description": ...}` — any flag name works, e.g.
`{"flags": "-j, --as-json"}`.

## Three modes

```bash
greet world                              # CLI in, rendered output (if any)
greet world --json                       # CLI in, JSON out
greet --json '{"name":"world"}'          # JSON in, JSON out
```

The flag takes an optional value (`--json [value]`):

- **Absent** — normal CLI parsing, the handler runs, and the validated output
  goes to the command's render if it has one; otherwise nothing is printed.
- **Present without a value** — CLI parsing for input, but the handler's
  return is serialized as JSON to stdout.
- **Present with a JSON value** — input comes from the JSON value; CLI
  positionals and options are skipped, so required positionals may be left
  off; output is JSON.

## What happens on `--json '<value>'`

1. Checks the value is JSON.
2. Validates it against the input model in pydantic's strict mode
   (`model_validate_json(value, strict=True)`).
3. Calls the handler with the validated input and `context.json is True`.
4. Validates the handler's return against the output type.
5. Dumps it in pydantic's JSON mode, by alias, leaving out `None` optionals,
   and writes it to stdout as JSON indented by two spaces, with a newline.

When `--json` is passed alone (no value), step 1 is skipped and input is
collected from the regular CLI parse instead. Steps 3–5 are identical.

The value must be strict JSON (RFC 8259): `NaN`, `Infinity` and a number out
of a double's range such as `1e400` fail as
`error: --json value is not valid JSON: …`. An integral float such as `3.0`
fills an `int` field, as zod takes it.

Output holding a non-finite float — `float("nan")` — fails at its path with
pydantic's `finite_number` error, with or without `--json`, instead of
printing `NaN`.

JSON input bypasses click, so env vars, choices checks, a field's `parse`,
number parsing, `conflicts` and `implies` do not apply — the model's defaults
and validation still do. An invariant that must hold in both modes belongs in
the model, as a `@model_validator(mode="after")`.
Send each value in its real type: `["a","b"]`, not `"a,b"`; `3`, not `"3"` —
strict mode rejects a string for an `int`, like zod does. Strings still
carry the types JSON has no literal for: an ISO 8601 `datetime`, a `UUID`,
an `Enum` value. Keys the model does not declare are ignored, as pydantic
does by default.

## Keeping stdout clean

The handler's optional second parameter tells it which mode it runs in. In
JSON mode, anything else written to stdout corrupts the result, so spinners,
colors and progress output should check `context.json`:

```python
import click
from pydantic import BaseModel
from fireargs import Context, command


class SyncInput(BaseModel):
    source: str


@command()
def sync(input: SyncInput, context: Context) -> list[str]:
    if not context.json:
        click.echo(f"Syncing {input.source}…", err=True)
    return [input.source]
```

## Errors

Without a hook, a value that is not JSON and input that fails the model are
reported like a commander parse error, written to stderr with exit code 1:

```text
error: --json value is not valid JSON: Expecting value: line 1 column 1 (char 0)
error: invalid --json input at 'items[0][1]': Input should be a valid integer
```

The path reads like TypeScript's (`a.b[0]`); the message after the colon is
pydantic's. Output validation failures and
handler exceptions propagate out of the click command: in standalone mode
click prints the traceback and exits 1, and with `standalone_mode=False` or
`CliRunner` the exception is raised or captured.

Set `render_error` in the command's or program's config to turn all of them
into output instead — the hook receives the original `json.JSONDecodeError`
or pydantic `ValidationError` for input failures, and the exception itself
for output, handler and render failures:

```python
from fireargs import Context, Program


def render_error(error: Exception, context: Context) -> object:
    return {"error": str(error)} if context.json else f"error: {error}"


cli = Program(name="myapp", render_error=render_error, router={"greet": greet})
```

- In JSON mode a returned value is written as JSON to stdout; otherwise a
  returned string is written to stderr. Return `None` to write it yourself;
  raise to propagate as before.
- The run then exits with code 1, through click's own exit.
- It also catches render failures. The nearest hook wins: the leaf's own,
  then each enclosing program's. A hook may be `async def`.

Click's parse errors (unknown option, extra argument) happen before the run
starts: click prints its usage line and `Error: ...` to stderr and exits with
code 2. A missing required positional, an unknown subcommand, a `conflicts`
violation, a token that is no choice and a CLI value that number parsing or a
field's `parse` rejects are reported in commander's wording, with exit code 1 — in
TypeScript commander rejects them while parsing. None of these reach
`render_error`.

## Composes with subcommands

Every leaf in a program tree gets its own `--json`:

```bash
myapp greet --json '{"name":"world"}'
myapp api deploy --json '{"env":"prod"}'
```

The program itself doesn't have a `--json` — programs dispatch to
subcommands; only leaves take input. See [Programs](/python/programs/).

## Pairs with `--llms`

Together with [LLMs mode](/python/llms-mode/), `--json` is the call-time
half of fireargs's agentic interface: an LLM reads the `--llms` manifest to
learn the schemas, then calls back through `--json` with a value matching
the documented `inputSchema`.
