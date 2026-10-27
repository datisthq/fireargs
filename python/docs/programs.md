---
title: Programs
path: /python/programs/
icon: folder-tree
order: 6
description: Program() for subcommand trees, including nested programs.
---

# Programs

`Program(router={...}, **config)` builds a CLI tree: `router` maps each
subcommand name to a command or a nested program, and the remaining keyword
arguments are the program's config. A `Program` is a subclass of click's
`Group`.

```python
from typing import Literal
from pydantic import BaseModel
from fireargs import Program, command


class GreetInput(BaseModel):
    name: str


class GreetOutput(BaseModel):
    greeting: str


@command(description="Greet someone")
def greet(input: GreetInput) -> GreetOutput:
    return GreetOutput(greeting=f"hello {input.name}")


class DeployInput(BaseModel):
    env: Literal["staging", "prod"]


class Deployed(BaseModel):
    ok: bool


@command(description="Deploy the app")
def deploy(input: DeployInput) -> Deployed:
    return Deployed(ok=True)


cli = Program(
    name="myapp",
    description="My CLI",
    version="1.0.0",
    router={"greet": greet, "deploy": deploy},
)

if __name__ == "__main__":
    cli()
```

`myapp greet --name world`, `myapp deploy --env prod`, `myapp --help`,
`myapp --llms` all work, and `myapp` alone prints the help.

## The router key wins as the subcommand name

`router={"greet": some_command}` attaches `some_command` under the name
`"greet"` even if the leaf was built with `name="something-else"` or from a
function with another name. Decoupling the program-level routing from each
leaf's own naming makes it easy to mount the same command twice or rename at
attach time.

## Nesting

A route is either a `Command` (from `@command(...)`) or a `Program`, so a
program can be a subcommand of another program:

```python
api = Program(description="API tasks", router={"greet": greet, "deploy": deploy})
db = Program(description="Database tasks", router={"migrate": migrate, "seed": seed})

cli = Program(name="myapp", router={"api": api, "db": db, "status": status})

# myapp api greet --name world
# myapp db migrate
# myapp status
```

`--llms` flattens the tree to space-separated tool names — the inner `greet`
becomes `"api greet"` in the manifest. See [LLMs mode](/python/llms-mode/).

## `Command`, `Program` and `Route`

`Command` subclasses click's `Command` and `Program` subclasses click's
`Group`, so `main(...)`, `--help`, `CliRunner` and the rest of click work
unchanged. `Route` is their union. A plain click command isn't a `Route`:
without fireargs' schemas it would be missing from `--llms`, so `Program`
rejects it with a `TypeError`.

```python
from fireargs import Command, Program, Route
```

## Aliases

`aliases=["ls"]` on a command or nested program lets its parent route the
extra names to it too. Aliases are not listed in `--help` and add no tools to
`--llms`; mount the route under a second router key when it should be
listed.

## Grouping commands in help

Set `help_group` on a command or a nested program to list it under its own
heading in the parent's `--help`, the same way `Option(help_group=...)`
groups options. Click adds the trailing colon, so write `"Ops"`, not
`"Ops:"`. Routes without one stay under `Commands`, and headings print in
the order their first route appears.

```python
@command(description="Deploy", help_group="Ops")
def deploy(input: DeployInput) -> Deployed: ...


users = Program(description="Manage users", help_group="Ops", router={"list": list_users})

Program(name="myapp", router={"deploy": deploy, "users": users, "version": version})
# Ops:
#   deploy  Deploy
#   users   Manage users
#
# Commands:
#   version  Print version
```

## `ProgramConfig`

Same keywords as [`CommandConfig`](/python/commands/#commandconfig) minus
`json_option` — programs dispatch, they don't read JSON input. Everything
else applies: `name`, `description`, `aliases`, `help_group`, `version`,
`version_option`, `llms_option`, `render_error` and click's
`context_settings`, `epilog`, `short_help`, `options_metavar`,
`add_help_option`, `no_args_is_help`, `hidden` and `deprecated`.

Two of them reach past the program itself:

- `version` with `version_option={"flags": "-v, --version"}` keeps a short
  version flag.
- `render_error` set on a program covers every leaf below it that has no
  hook of its own, so one hook formats errors for the whole tree (see
  [JSON mode](/python/json-mode/#errors)). `@cli.render_error` registers it
  as a decorator.

## Options belong to their level

Click reads options up to the subcommand name as the program's and leaves
the rest to the subcommand, so `myapp --llms` is the program's flag and
`myapp greet --llms` the leaf's. No setting is needed for tree CLIs.

## `--help` and `--llms` per level

Each level keeps its own:

```bash
myapp                      # top-level help, the same as --help
myapp --help               # top-level help, lists subcommands
myapp help greet           # leaf-level help, the same as greet --help
myapp greet --help         # leaf-level help, lists args/options
myapp --llms               # entire tree as a flat MCP tools/list
myapp greet --llms         # just the greet leaf
```

Suppress program-level `--llms` with `llms_option=False` in the program
config; subcommands keep theirs.

An unknown subcommand prints `error: unknown command 'nope'` to stderr and
exits 1, at every level.
