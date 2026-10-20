import json

import click
from pydantic_core import to_jsonable_python

from ...models.command import Leaf
from ...models.context import Context
from ...models.program import Program
from ..awaitable.run import run_awaitable


def handle_error(ctx: click.Context, error: Exception, context: Context):
    """Route a failed run to the nearest `render_error` hook, or re-raise without one.
    Writes what the hook returns and exits with code 1."""
    renderer = find_error_handler(ctx)
    if renderer is None:
        raise error

    rendered = run_awaitable(renderer(error, context))
    if context.json and rendered is not None:
        click.echo(json.dumps(to_jsonable_python(rendered), indent=2, ensure_ascii=False))
    elif isinstance(rendered, str):
        click.echo(rendered, err=True)
    ctx.exit(1)


def find_error_handler(ctx: click.Context):
    """Find the nearest `render_error` hook: the running command's, then each parent's."""
    current: click.Context | None = ctx
    while current is not None:
        command = current.command
        if isinstance(command, Leaf | Program) and command.error_renderer is not None:
            return command.error_renderer
        current = current.parent
    return None
