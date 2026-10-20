from collections.abc import Awaitable, Callable
from dataclasses import dataclass
from typing import Literal

import click
from pydantic import BaseModel, TypeAdapter

from .context import Context, RenderContext
from .field import FieldMeta

type Render[I, O] = Callable[[O, RenderContext[I]], str | None | Awaitable[str | None]]
type RenderError = Callable[[Exception, Context], object]


@dataclass(frozen=True, kw_only=True)
class FieldSpec:
    """How one input field is read from argv: its key, CLI name and value shape."""

    key: str
    kind: Literal["argument", "option"]
    name: str
    flags: str
    description: str | None
    default: object = None
    required: bool
    variadic: bool
    number: bool
    parse: Callable[[str], object] | None
    meta: FieldMeta | None


class FieldOption(click.Option):
    """A click option that remembers the help group it is listed under."""

    help_group: str | None = None


class Leaf(click.Command):
    """What every `Command` carries whatever its input and output types."""

    fields: tuple[FieldSpec, ...] = ()
    json_param: str | None = None
    llms_param: str | None = None
    aliases: tuple[str, ...] = ()
    help_group: str | None = None
    error_renderer: RenderError | None = None


class Command[I: BaseModel, O](Leaf):
    """A leaf built by `@command(...)`: a click command with typed input, output and a
    handler, plus `--json` and `--llms`."""

    handler: Callable[..., O | Awaitable[O]]
    takes_context: bool
    input: type[I]
    output: TypeAdapter[O]
    renderer: Render[I, O] | None = None

    def render(self, renderer: Render[I, O]) -> Render[I, O]:
        """Register the human-mode render; its returned string is printed, `--json` skips it."""
        self.renderer = renderer
        return renderer

    def render_error(self, renderer: RenderError) -> RenderError:
        """Register this command's `render_error` hook; the nearest hook wins."""
        self.error_renderer = renderer
        return renderer

    def format_options(self, ctx: click.Context, formatter: click.HelpFormatter) -> None:
        groups: dict[str, list[tuple[str, str]]] = {"Arguments": [], "Options": []}
        for spec in self.fields:
            if spec.kind != "argument":
                continue
            shown = f"[default: {spec.default}]" if spec.default is not None else ""
            text = "  ".join(part for part in [spec.description or "", shown] if part)
            if text:
                groups["Arguments"].append((spec.name, text))
        for param in self.get_params(ctx):
            record = param.get_help_record(ctx)
            if record is None:
                continue
            group = param.help_group if isinstance(param, FieldOption) else None
            groups.setdefault(group or "Options", []).append(record)
        for title, records in groups.items():
            if records:
                with formatter.section(title):
                    formatter.write_dl(records)
