from dataclasses import dataclass

import click


@dataclass(frozen=True)
class Context:
    """What a handler, a render or `render_error` knows about the run: whether `--json`
    was given (with or without a value) and the click command that is running."""

    json: bool
    command: click.Command


@dataclass(frozen=True)
class RenderContext[I](Context):
    """The context a render receives: a `Context` plus the parsed input."""

    input: I
