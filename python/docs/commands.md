---
title: Commands
path: /python/commands/
icon: terminal
order: 3
description: The @command(...) decorator and the leaf it builds from a handler.
---

# Commands

`@command(**config)` turns a handler function into a `Command`, a subclass
of click's `Command`. The handler's first parameter annotation is the input
model, its return annotation is the output type, and an optional second
parameter receives a `Context`. Without config,
`@command` and `@command()` are the same.

```python
from pydantic import BaseModel
from fireargs import command


class GreetInput(BaseModel):
    name: str


class GreetOutput(BaseModel):
    greeting: str


@command()
def greet(input: GreetInput) -> GreetOutput:
    return GreetOutput(greeting=f"hello {input.name}")


if __name__ == "__main__":
    greet()
```

The command is named after the function in kebab-case — `list_users` becomes
`list-users` — unless `name` is set. Under a [program](/python/programs/) the
router key names it instead.

## Input and output

The input must be a pydantic `BaseModel` subclass: its fields determine the
positional arguments and `--options` (see [Inputs](/python/inputs/)). A
command without input takes an empty model. The output can be any type
pydantic validates — a model, a `list[...]`, a scalar, `None` (see
[Outputs](/python/outputs/)). The handler's return value is validated
against it on every run, so returning a matching `dict` works and a mismatch
raises pydantic's `ValidationError`.

A handler without these annotations is rejected with a `TypeError` when it
is decorated.

## `@command.render`

Optional. Turns the validated output into what a human sees at the shell.
It runs only without `--json`; with it, the output is written as JSON
instead. A returned string is written to stdout with a trailing newline;
return `None` to write the output yourself (spinners, colors, tables).
Declare a second parameter to receive a `RenderContext` carrying `input`
(the parsed input), `json` and `command`. Without a render, a run without
`--json` prints nothing.

```python
from typing import Annotated
from pydantic import BaseModel
from fireargs import Argument, command


Path = Annotated[str, Argument()]


class ListInput(BaseModel):
    path: Path


@command()
def list_names(input: ListInput) -> list[str]:
    return [f"{input.path}/a", f"{input.path}/b"]


@list_names.render
def render_names(output: list[str]) -> str:
    return "\n".join(f"- {name}" for name in output)
```

## The handler

Receives the parsed, pydantic-validated input and, when it declares a second
parameter, a `Context`. Must return a value matching the output type.

`context.json` is `True` when `--json` was given, with or without a value: a
handler that drives spinners or progress output keeps quiet then, so stdout
stays parseable. `context.command` is the running click command.

Handlers, renders and `render_error` hooks may be `async def`: fireargs runs
the coroutine with `asyncio.run`. Click itself is synchronous, so a command
with an async handler cannot be invoked from code that is already inside a
running event loop.

```python
import asyncio
from pydantic import BaseModel
from fireargs import Context, command


class FetchInput(BaseModel):
    url: str


@command(description="Fetch a URL")
async def fetch(input: FetchInput, context: Context) -> dict[str, str]:
    await asyncio.sleep(0)
    return {"url": input.url, "mode": "json" if context.json else "text"}
```

Input that fails the model is reported like a commander parse error — one
`error: ...` line per field on stderr, exit code 1. Other exceptions
propagate out of the click command: in click's standalone mode they print a
traceback and exit 1. A `render_error` hook takes all of them instead (see
[JSON mode](/python/json-mode/#errors)).

## What gets derived from the input model

For each field of the input model:

| Pydantic construct          | Becomes                                                                                  |
| --------------------------- | ---------------------------------------------------------------------------------------- |
| `str` / `int` / `float`     | `--key <value>`, required unless defaulted; a number's CLI string is parsed              |
| `bool`                      | `--key` flag                                                                             |
| `Annotated[T, Argument()]`  | positional `<key>`; `[key]` when it has a default                                        |
| a default value             | shown as `[default: …]` in `--help`; pydantic fills it                                   |
| `Literal[...]` / an `Enum`  | choices, each the JSON text of a value: `--key [1\|2]`; the token maps back to the value |
| `list[T]`                   | `--key <value>`, repeated `--key a --key b`; positional variadic `<key...>`              |
| `list[Literal[...]]`        | repeated, with choices on each value                                                     |
| `tuple[A, B]`               | repeated, each value converted by its position; `tuple[T, ...]` as `list[T]`             |
| `X \| None = None`          | optional; left out of `--json` output while `None`                                       |
| `description=` on the field | shown in `--help` and surfaced as `description` in `--llms` JSON Schema                  |

Positional arguments are declared in field order, before every option. `key`
is shown in kebab-case: `header_rows` becomes `--header-rows`, while the
handler, `--json` and `--llms` keep `header_rows`. See
[Flag names](/python/inputs/#flag-names).

For per-field click config that pydantic doesn't model (short flag, env var,
conflicts, hidden, a flag value, a custom `parse`, …) annotate the field with
[`Argument(...)` or `Option(...)`](/python/inputs/).

## `CommandConfig`

The keyword arguments of `@command(...)`. All are optional.

| Field                                     | What it does                                                                                              |
| ----------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| `name`                                    | the command name; defaults to the function name in kebab-case                                             |
| `description`                             | help text, and the tool `description` in `--llms`                                                         |
| `aliases`                                 | extra names the parent program also routes to this command                                                |
| `help_group`                              | heading this command is listed under in its parent's help                                                 |
| `version`                                 | adds a `-V, --version` flag printing it                                                                   |
| `version_option`                          | `{"flags": ..., "description": ...}` for that flag, e.g. `{"flags": "-v, --version"}`                     |
| `json_option`, `llms_option`              | customize or disable the built-in `--json`/`--llms` flags. See [LLMs mode](/python/llms-mode/)            |
| `render_error`                            | `(error[, context]) -> value` — turn a failed run into output. See [JSON mode](/python/json-mode/#errors) |
| `context_settings`                        | click's `context_settings`, e.g. `{"help_option_names": ["-h", "--help"]}`                                |
| `epilog`, `short_help`, `options_metavar` | click's help text slots                                                                                   |
| `add_help_option`, `no_args_is_help`      | click's help toggles                                                                                      |
| `hidden`, `deprecated`                    | click's: leave out of the parent's help, or mark deprecated                                               |

`render_error` can also be registered with a decorator, like the render:
`@greet.render_error`.

The returned `Command` is a real click command, so the rest of click works
unchanged: `greet.main(args, standalone_mode=False)`, click's `CliRunner`, or
`add_command` on a plain `click.Group`.

## Why a decorator

The handler's annotations already state the input and output types; the
decorator reads them instead of asking for them twice, so the schemas and the
handler cannot drift apart, and type checkers see the same types fireargs
validates.
