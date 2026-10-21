---
title: Composability
path: /python/composability/
icon: boxes
order: 9
description: Share common parameters across commands by composing pydantic models.
---

# Composability

Inputs and outputs in fireargs are pydantic models, so anything pydantic can
compose works here too — inheritance, `Annotated` field aliases, generic
models, nested models. Define common parameters once and reuse them across
every command that needs them, including the per-field click config you
attached via `Argument()` / `Option()`.

## Reusable fields

An `Annotated` alias is a field you can drop into any model. Its CLI config
and its default travel with it, and a use site can still override the default.
Type checkers see only `= value` defaults, so a model you build by hand in code
(a test, say) needs those fields spelled out:

```python
from typing import Annotated
from fireargs import Option

Page = Annotated[int, Option(short="p", default=1, ge=1, description="Page number")]
Limit = Annotated[int, Option(short="l", default=20, ge=1, le=100, description="Page size")]
Verbose = Annotated[bool, Option(short="v", default=False)]
```

## Reusable parameter blocks

Group fields into a model and mix it into each command's input by
inheritance:

```python
from pydantic import BaseModel


class Pagination(BaseModel):
    page: Page
    limit: Limit


class Verbosity(BaseModel):
    verbose: Verbose
```

The metadata you attached with `Option(...)` lives on the field, so when
you reuse `Pagination` in another command, `--page` / `-p` still come along
for free.

## Composing into a command

```python
from typing import Literal


class User(BaseModel):
    id: str
    name: str


class UsersInput(Pagination, Verbosity):
    role: Literal["admin", "user"] | None = None


class UsersOutput(BaseModel):
    users: list[User]
    total: int


@command(description="List users")
def list_users(input: UsersInput) -> UsersOutput:
    return UsersOutput(users=[], total=0)
```

Pydantic orders inherited fields by the method resolution order, from the
last base to the first, then the class's own: `UsersInput(Pagination,
Verbosity)` declares `verbose`, then `page` and `limit`, then `role`. That
order is the `--help` order, and for positionals the order they are read in
— keep blocks with positionals in a deliberate place among the bases.

A field redeclared in a subclass replaces the inherited one, so a command
can change one default and keep the rest of the block:

```python
class EventsInput(Pagination):
    limit: Limit = 50
    since: str | None = None
```

## Reusable output blocks

Output models compose the same way. A common pattern is a generic
"paginated response" model:

```python
class Paginated[T](BaseModel):
    items: list[T]
    total: int
    page: int
    limit: int


class Post(BaseModel):
    id: str
    title: str


@command(description="List posts")
def list_posts(input: Pagination) -> Paginated[Post]:
    return Paginated(items=[], total=0, page=input.page, limit=input.limit)
```

Every `Paginated[...]` output ends up with identical pagination metadata in
its `--llms` JSON Schema — same source of truth. The item model lands in
`$defs`.

## Shared handler code

The decorator reads the handler's annotations, so each command keeps its own
small handler with concrete types; shared scaffolding goes into plain
functions the handlers call:

```python
def paginate[T](items: list[T], input: Pagination) -> Paginated[T]:
    start = (input.page - 1) * input.limit
    return Paginated(
        items=items[start : start + input.limit],
        total=len(items),
        page=input.page,
        limit=input.limit,
    )


@command(description="List members")
def list_members(input: UsersInput) -> Paginated[User]:
    return paginate([User(id="1", name="Ada")], input)
```

The helper hides the boilerplate; the commands only specify what genuinely
differs.

## Programs as another composition layer

Beyond model composition, `Program(...)` composes _commands themselves_
into trees. Mounting the same leaf under different router keys is a valid
form of reuse:

```python
cli = Program(name="myapp", router={"users": list_users, "members": list_users})
```

Both invocation paths route to the same handler. See
[Programs](/python/programs/) for the dispatch and `--llms` flattening
details.

## What carries through

When you reuse a field or a block, every per-field detail rides along:

- **Pydantic's own metadata** — `description`, defaults, constraints,
  `alias`, `Literal` choices, validators.
- **fireargs config** — `Argument()` / `Option()` (name, short, envvar,
  conflicts, hidden, flag_value, help_group, default_description, parse).

Both surface in click's `--help` and in the `--llms` manifest exactly as if
you'd written the fields inline. Compose freely; nothing leaks or
duplicates.
