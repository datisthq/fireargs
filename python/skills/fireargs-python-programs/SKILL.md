---
name: fireargs-python-programs
description: Use when building a multi-command Python Fireargs CLI — f.Program(router=...), nested programs, aliases, help groups, ProgramConfig, and sharing parameters, outputs and commands across the tree by composing pydantic models.
---

# Fireargs Python Programs

Guidance for assembling Fireargs for Python commands into a subcommand tree and reusing pieces across it.

## When to use this skill

Invoke when the user asks to:

- Turn several commands into one binary (`myapp greet`, `myapp deploy`).
- Nest command groups (`myapp db migrate`), rename or alias a subcommand, or mount one command twice.
- Group subcommands under headings in `--help`.
- Share options, output shapes or handler scaffolding between commands.

## The router

`f.Program(router={...}, **config)` returns a `Program`, a click `Group`:

```python
import fireargs as f

db = f.Program(description="Database tasks", router={"migrate": migrate, "seed": seed})

cli = f.Program(
    name="myapp",
    description="My CLI",
    version="1.0.0",
    router={"greet": greet, "deploy": deploy, "db": db},
)

if __name__ == "__main__":
    cli()
# myapp greet world · myapp db migrate · myapp --help · myapp --llms
```

- **The router key is the subcommand name.** It overrides the command's own name, so `{"users": list_users, "members": list_users}` mounts the same leaf twice.
- **Routes are `Command | Program`** (exported as the `Route` type). A plain click command is rejected with a `TypeError`: it has no schemas to put in the manifest.
- **`aliases=["ls"]`** on a command or nested program lets the parent route that name too; aliases are not listed in `--help` and add no `--llms` tools.
- `myapp` alone prints the help. Options before the subcommand name belong to the program, options after it to the subcommand — click's default, no setting needed.

## `ProgramConfig`

The same keywords as `CommandConfig` (see `fireargs-python-commands`) without `json_option`: a program dispatches and takes no input, so only leaves get `--json`. `--llms` on a program prints the whole tree; `llms_option=False` removes it from that level only.

Two settings belong on the root program:

- `version` plus `version_option={"flags": "-v, --version"}` for a lowercase short version flag (default `-V, --version`).
- `render_error` (or `@cli.render_error`) formats errors for every leaf below that has no hook of its own (see `fireargs-python-automation`).

## Help groups

Set `help_group` on a command's or nested program's config to list it under its own heading in the parent's `--help`. Write the heading without a colon — click adds it. Routes without one stay under `Commands`; headings appear in the order their first route does. `f.Option(help_group=...)` does the same for options.

```python
@f.command(description="Deploy", help_group="Ops")
def deploy(input: DeployInput) -> Deployed: ...


users = f.Program(description="Manage users", help_group="Ops", router={"list": list_users})
cli = f.Program(name="myapp", router={"deploy": deploy, "users": users, "version": version})
```

## Composing across commands

Inputs and outputs are plain pydantic models, and Fireargs config lives on each field, so everything composes and the `f.Option(...)` config rides along:

```python
Page = Annotated[int, f.Option(short="p", ge=1)]
Limit = Annotated[int, f.Option(short="l", ge=1, le=100)]


class Pagination(BaseModel):
    page: Page = 1
    limit: Limit = 20


class UsersInput(Pagination):
    role: Literal["admin", "user"] | None = None


@f.command(description="List users")
def list_users(input: UsersInput) -> Paginated[User]:
    return paginate(fetch_users(input.role), input)
```

- **Reusable fields:** `Annotated` aliases such as `Limit`, with the default given at each use site.
- **Parameter blocks:** mixin models. Fields of later bases come first — `class C(A, B)` declares `B`'s fields, then `A`'s, then `C`'s — which is the `--help` order and the positional order. Redeclaring a field in the subclass changes it in place.
- **Output wrappers:** a generic model such as `class Paginated[T](BaseModel)`, so every list command shares one wire shape and one manifest schema.
- **Shared handler code:** plain functions such as `paginate(items, input)`. Each command keeps its own small handler, because the decorator reads concrete annotations.

## Rules of thumb

1. **Name subcommands at the router.** A leaf only ever mounted needs no `name`; the function name only matters for a leaf run on its own.
2. **One leaf, one job.** Each leaf becomes one tool in the manifest, so a leaf switching behaviour on a mode flag is harder for an agent to call than two leaves.
3. **Describe every route.** A command's `description` is its help line and its manifest description; a program's is shown in its parent's help.
4. **Share fields as models and aliases, not copies.** A reused block keeps `--help`, `--json` and `--llms` consistent; a copy drifts.

## Verification

- `myapp --help` and `myapp <group> --help` list every route, under the intended headings.
- `myapp --llms` lists every leaf once per router key, named by its full path (`"db migrate"`).
- Each leaf still runs on its path with `--json '<value>'`.

## References

- Programs: https://fireargs.dev/python/programs/
- Composability: https://fireargs.dev/python/composability/
