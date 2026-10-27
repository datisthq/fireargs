---
title: Interactivity
path: /python/interactivity/
icon: messages-square
order: 9
description: Ask for missing values and confirmations without breaking scripts and agents.
---

# Interactivity

Fireargs never reads stdin, so the handler is free to prompt the user. The
same command still serves scripts and LLM agents, which cannot answer a
prompt. Keep it working for both with four rules:

- **Optional in the model.** A prompted field is `X | None = None`, so a
  value given as a flag or through `--json` skips the prompt.
- **Never in JSON mode.** `context.json` is `True` under `--json`, and an
  agent waiting on JSON would hang on a question.
- **Only on a terminal.** `sys.stdin.isatty()` is false in a pipe or CI.
  Fail there with an error that names the flag to pass.
- **Prompts go to stderr.** stdout carries the rendered or JSON output.

## Asking for a missing value

```python
import sys
import click
from pydantic import BaseModel, Field
from fireargs import Context, command


class InitInput(BaseModel):
    name: str | None = Field(None, description="Project name; asked for when left out.")


class InitOutput(BaseModel):
    name: str


def render_error(error: Exception) -> str:
    return f"error: {error}"


@command(description="Create a project.", render_error=render_error)
def init(input: InitInput, context: Context) -> InitOutput:
    name = input.name
    if name is None:
        if context.json or not sys.stdin.isatty():
            raise ValueError("--name is required when not run in a terminal")
        name = click.prompt("Project name", err=True)
    return InitOutput(name=name)


@init.render
def render_init(output: InitOutput) -> str:
    return f"Created {output.name}"


if __name__ == "__main__":
    init()
```

```bash
$ python init.py                    # a terminal: asks
Project name: demo
Created demo
$ python init.py --name demo        # the flag skips the prompt
Created demo
$ python init.py < /dev/null        # no terminal: fails, exit code 1
error: --name is required when not run in a terminal
```

`render_error` turns the raised error into an `error: …` line instead of a
traceback — see [JSON mode](/python/json-mode/) for its JSON-aware form. Raise
a plain exception rather than a `click.UsageError`: click reports its own
exceptions itself, never through the hook — a `UsageError` with click's usage
text and exit code 2.

click is already installed with fireargs, so `click.prompt` and
`click.confirm` need no extra dependency; `err=True` sends the question to
stderr.

## Confirming a destructive action

Give the command a `--yes` flag that answers the confirmation up front, so a
script never has to:

```python
Yes = Annotated[bool, Option(short="y", default=False, description="Skip the prompt.")]

# in the handler
if not input.yes:
    if context.json or not sys.stdin.isatty():
        raise ValueError("pass --yes to confirm when not run in a terminal")
    if not click.confirm(f"Delete {input.path}?", err=True):
        return DeleteOutput(deleted=False)
```

## `Option(prompt=...)`

[`Option`](/python/inputs/) also passes click's own `prompt`, `hide_input`
and `confirmation_prompt` through. click asks at parse time, before the
handler, and does not follow the rules above: it still asks under
`--json '<value>'`, and writes the question to stdout. Use it only for
commands that are never scripted; prompt in the handler for the rest.

## Richer prompts

For selects, checkboxes or fuzzy search, call a prompt library such as
[questionary](https://pypi.org/project/questionary/) from the handler under
the same rules.

## In the manifest

The [`--llms` manifest](/python/llms-mode/) shows a prompted field as
optional, which is what an agent sees: it passes the value through `--json`,
or gets the error. Say in the field's description that it is asked for when
left out, so a person reading `--help` knows too.
