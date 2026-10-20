from collections.abc import Mapping
from typing import Unpack

import click

from .command import Leaf, RenderError
from .config import ProgramConfig


class Program(click.Group):
    """A subcommand tree: `router` maps each name to a command or a nested program."""

    routes: dict[str, "Route"]
    aliases: tuple[str, ...] = ()
    help_group: str | None = None
    error_renderer: RenderError | None = None

    def __init__(self, *, router: Mapping[str, "Route"], **config: Unpack[ProgramConfig]):
        from ..actions.program.compile import compile_program

        super().__init__(
            config.get("name"),
            help=config.get("description"),
            epilog=config.get("epilog"),
            short_help=config.get("short_help"),
            options_metavar=config.get("options_metavar", "[OPTIONS]"),
            add_help_option=config.get("add_help_option", True),
            no_args_is_help=config.get("no_args_is_help", False),
            hidden=config.get("hidden", False),
            deprecated=config.get("deprecated", False),
            context_settings=dict(config.get("context_settings", {})),
            invoke_without_command=True,
        )
        compile_program(self, router, config)

    def render_error(self, renderer: RenderError) -> RenderError:
        """Register the `render_error` hook for this subtree; the nearest hook wins."""
        self.error_renderer = renderer
        return renderer

    def get_command(self, ctx: click.Context, cmd_name: str) -> click.Command | None:
        if cmd_name in self.commands:
            return self.commands[cmd_name]
        for route in self.routes.values():
            if cmd_name in route.aliases:
                return route
        return None

    def list_commands(self, ctx: click.Context) -> list[str]:
        return list(self.commands)

    def format_commands(self, ctx: click.Context, formatter: click.HelpFormatter) -> None:
        groups: dict[str, list[tuple[str, str]]] = {}
        width = (
            formatter.width - 6 - max((len(name) for name in self.commands), default=0)
        )
        for name, route in self.routes.items():
            if route.hidden:
                continue
            group = groups.setdefault(route.help_group or "Commands", [])
            group.append((name, route.get_short_help_str(width)))
        for title, records in groups.items():
            if records:
                with formatter.section(title):
                    formatter.write_dl(records)


type Route = Leaf | Program
