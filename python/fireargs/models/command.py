import os
from collections.abc import Awaitable, Callable, Sequence
from dataclasses import dataclass
from typing import Literal

import click
from click.types import OptionHelpExtra
from pydantic import BaseModel, TypeAdapter

from .context import Context, RenderContext
from .field import FieldMeta

type RenderResult = str | None | Awaitable[str | None]
type Render[I, O] = (
    Callable[[O], RenderResult] | Callable[[O, RenderContext[I]], RenderResult]
)
type RenderError = Callable[[Exception], object] | Callable[[Exception, Context], object]


@dataclass(frozen=True)
class ValueType:
    """How one CLI string converts before validation: to a number, to the value among
    `values` whose JSON text it equals in `choices`, or not at all."""

    number: bool = False
    choices: tuple[str, ...] | None = None
    values: tuple[object, ...] = ()


@dataclass(frozen=True, kw_only=True)
class FieldSpec:
    """How one input field is read from argv: its key, CLI name and value shape, where a
    fixed tuple's `items` type each position and `element` types every other value."""

    key: str
    alias: str | None = None
    kind: Literal["argument", "option"]
    name: str
    flags: str
    description: str | None
    default: object = None
    required: bool
    variadic: bool
    element: ValueType = ValueType()
    items: tuple[ValueType, ...] | None = None
    parse: Callable[[str], object] | None
    meta: FieldMeta | None


TRUE_WORDS = ("1", "true", "yes", "on", "y", "t")
FALSE_WORDS = ("0", "false", "no", "off", "n", "f")


class FieldOption(click.Option):
    """A click option that remembers the help group it is listed under, and reads a
    boolean flag's env var as the twins do."""

    help_group: str | None = None
    boolean_flags: str | None = None
    shown_default: str | None = None

    def get_help_extra(self, ctx: click.Context) -> OptionHelpExtra:
        extra = super().get_help_extra(ctx)
        if self.shown_default is not None:
            extra["default"] = self.shown_default
        return extra

    def value_from_envvar(self, ctx: click.Context) -> str | Sequence[str] | None:
        value = super().value_from_envvar(ctx)
        if self.boolean_flags is None or not isinstance(value, str):
            return value
        word = value.strip().lower()
        if word in TRUE_WORDS:
            return "true"
        if word in FALSE_WORDS:
            return "false"
        if word == "":
            return None
        names = [self.envvar] if isinstance(self.envvar, str) else self.envvar or []
        env = next((name for name in names if os.environ.get(name) == value), "")
        click.echo(
            f"error: option '{self.boolean_flags}' value '{value}' from env '{env}'"
            " is invalid. Not a boolean.",
            err=True,
        )
        ctx.exit(1)


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
