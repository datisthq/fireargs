---
title: Inputs
path: /python/inputs/
icon: square-pen
order: 4
description: Argument() and Option() for per-field click config.
---

# Inputs

Most field configuration comes from pydantic itself — descriptions and
defaults via `Field(...)`, constraints such as `ge` or `pattern`, choices via
`Literal[...]` or an `Enum`, repeated values via `list[...]`, optionality via
`X | None = None`. For click behavior that has no pydantic equivalent (short
flags, env vars, conflicts, hidden, a custom value parser, …) annotate the
field with `Argument(...)` or `Option(...)`.

## Default routing

Plain fields of the input model are `--options`. To make a field positional,
annotate it with `Argument()`:

```python
from typing import Annotated
from pydantic import BaseModel
from fireargs import Argument


Name = Annotated[str, Argument()]  # <name> positional


class GreetInput(BaseModel):
    name: Name
    verbose: bool = False  # --verbose option (default routing)
```

You can also use `Option()` explicitly to attach per-field option config —
even though plain fields are already options.

## Flag names

A field's flag is its name in kebab-case: `header_rows` becomes
`--header-rows`, and a positional `source_path` is shown as `<source-path>`.
The handler, `--json` input and the `--llms` manifest keep the field name
(`header_rows`). Set `name` to choose the flag yourself:

```python
from typing import Annotated
from pydantic import BaseModel
from fireargs import Option


ToPath = Annotated[str, Option(name="to")]  # --to <value>
DryRun = Annotated[bool, Option(name="dryRun")]  # --dryRun


class CopyInput(BaseModel):
    header_rows: int = 1  # --header-rows <value>
    to_path: ToPath = "."
    dry_run: DryRun = False
```

A name starting with `no_` gives a plain `--no-…` flag, not a negation:
`no_cache: bool = False` is `True` when `--no-cache` is passed.

## Wire keys shared with TypeScript

A Python field name is snake_case, so `--json` and `--llms` use snake_case
keys. To keep the keys of a TypeScript twin (`headerRows`), give the field a
pydantic `alias`, or the model an alias generator. `--json` input and output
and the `--llms` schemas then use the alias, while the flag is still derived
from the field name (`--header-rows`):

```python
from pydantic import BaseModel, ConfigDict
from pydantic.alias_generators import to_camel


class Wire(BaseModel):
    model_config = ConfigDict(alias_generator=to_camel, validate_by_name=True)


class ReadInput(Wire):
    header_rows: int = 1  # --header-rows, "headerRows" on the wire
```

`--json` input is read by alias; `validate_by_name=True` also accepts the
field name. Without it, a key sent under the field name is ignored like any
other unknown key.

## The wrappers

`Argument(**config)` and `Option(**config)` return a pydantic
`FieldInfo` — what `Field(...)` returns — with fireargs' config attached. Use
them inside `Annotated[...]`, so the type stays the field's own and a type
checker sees nothing new:

```python
from typing import Annotated
from pydantic import BaseModel
from fireargs import Option

Limit = Annotated[int, Option(short="l", ge=1, description="Max rows")]


class ListInput(BaseModel):
    limit: Limit = 20
```

An annotated alias like `Limit` is a reusable field: give it the default at
each use site, so two commands can share the flag with different defaults.

Both wrappers accept pydantic's own `Field` settings: `default`,
`default_factory`, `alias`, `title`, `description`, `examples`, `gt`, `ge`,
`lt`, `le`, `multiple_of`, `min_length`, `max_length`, `pattern`, `strict`
and `deprecated`. A `Field(...)` in the same `Annotated[...]` works too —
pydantic merges them.

## `OptionConfig`

`Option(...)` accepts, beyond the pydantic settings:

| Field                 | What it does                                                        |
| --------------------- | ------------------------------------------------------------------- |
| `name`                | Long flag without dashes, e.g. `"to"` → `--to`                      |
| `short`               | Short flag letter, e.g. `"v"` adds `-v` alongside `--verbose`       |
| `envvar`              | Environment variable(s) to fall back to when the flag is absent     |
| `show_envvar`         | Show the env var in `--help`                                        |
| `conflicts`           | Field name(s) of options that conflict with this one                |
| `implies`             | `{"field_name": value}` set when this option is given               |
| `hidden`              | Hide from `--help`                                                  |
| `flag_value`          | Value used when the flag appears without an argument                |
| `help_group`          | Heading under which this option is listed in help, e.g. `"Logging"` |
| `default_description` | Display string for the default value in help                        |
| `parse`               | Turns the CLI string into the field's value — see below             |
| `is_flag`, `count`    | click's: force a flag, or count repeats (`-vvv` → `3`) on an `int`  |
| `show_default`        | click's: `False` hides the default, a string replaces it            |
| `metavar`             | click's: the value placeholder in help, instead of `<value>`        |
| `prompt`              | click's: ask for the value interactively when it is missing         |
| `hide_input`          | click's: mask the prompt; errors never echo the value               |
| `confirmation_prompt` | click's: ask twice                                                  |

## `ArgumentConfig`

A positional takes fewer slots — no short flag, no conflicts/implies, no
hidden, no help group. Beyond the pydantic settings:

| Field                 | What it does                                            |
| --------------------- | ------------------------------------------------------- |
| `name`                | Name shown in help and usage, e.g. `<file>`             |
| `envvar`              | Environment variable(s) to fall back to when absent     |
| `metavar`             | Replaces `<name>` in the usage line                     |
| `default_description` | Display string for the default value in help            |
| `parse`               | Turns the CLI string into the field's value — see below |

A positional's default is shown next to its description under `Arguments`,
as `[default: …]`.

## Parsing CLI values

Click hands every value over as a string. fireargs converts it before
pydantic sees it, so the model describes the real value and `--json` callers
send that value directly:

- **Numbers parse automatically.** A field typed `int` or `float` (or a list
  of them) turns `--rows 10` into `10`, and rejects `--rows abc` with
  `error: option '--rows <value>' argument 'abc' is invalid. Not a number.`
  `--json '{"rows":"10"}'` is still rejected — the JSON value must be a
  number.
- **`parse` handles any other syntax.** It receives the raw string from argv
  or the env var and returns the field's value, which pydantic then
  validates. It never runs on `--json` input or on defaults.

```python
import json
from typing import Annotated, Literal
from pydantic import BaseModel
from fireargs import Option


def parse_header_rows(value: str) -> Literal[False] | list[int]:
    return False if value == "false" else [int(row) for row in value.split(",")]


# --missing-values a,b → ["a", "b"]
MissingValues = Annotated[list[str] | None, Option(parse=lambda value: value.split(","))]

# --header-rows false → False, --header-rows 1,2 → [1, 2]
HeaderRows = Annotated[Literal[False] | list[int] | None, Option(parse=parse_header_rows)]

# --props '{"a":1}' → {"a": 1}
Props = Annotated[dict[str, int], Option(parse=json.loads)]


class ReadInput(BaseModel):
    missing_values: MissingValues = None
    header_rows: HeaderRows = None
    props: Props = {}
```

A field with `parse` always takes exactly one value (`--key <value>`), even
when its type is a list or a bool: `parse` owns the whole string. An
exception raised by `parse` is reported as an invalid argument, with the
exception's message, and exits 1 without reaching `render_error`:

```text
error: option '--props <value>' argument 'nope' is invalid. Expecting value: line 1 column 1 (char 0)
```

Reach for `parse` rather than a pydantic `BeforeValidator` when the comma
list or JSON string is only shell syntax. A validator belongs to the model,
so `--json` callers would go through it too, and `--llms` cannot tell them
which string syntax it expects.

## Examples

```python
from typing import Annotated, Literal
from pydantic import BaseModel, Field
from fireargs import Argument, Option


# positional, required: <name>
Name = Annotated[str, Argument(description="user's name")]

# positional, optional: [greeting]; keep required positionals first
Greeting = Annotated[str | None, Argument()]

# option with short flag and env fallback
Port = Annotated[int, Option(short="p", envvar="PORT")]

# booleans with explicit conflicts
Rgb = Annotated[bool, Option(conflicts="cmyk")]

# hidden internal option
Secret = Annotated[str | None, Option(hidden=True)]

# flag value: --level alone is "info", --level debug is "debug"
Level = Annotated[str | None, Option(flag_value="info")]


class ServeInput(BaseModel):
    name: Name
    greeting: Greeting = None
    port: Port = 8080
    rgb: Rgb = False
    cmyk: bool = False
    secret: Secret = None
    # repeated, with choices: --formats json --formats yaml
    formats: list[Literal["json", "yaml", "toml"]] = []
    level: Level = None
    # a plain pydantic Field works too
    retries: int = Field(3, ge=0, description="Retry this many times")
```

## What if I forget the wrapper?

Plain fields work — they default to `--options` with pydantic's validation.
The wrappers only add **click**-specific config that pydantic can't express.
Don't sprinkle them everywhere; reach for them when you genuinely need a
positional, a short flag, an env binding, or one of the other slots above.
