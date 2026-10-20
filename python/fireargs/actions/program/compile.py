import json
from collections.abc import Mapping

import click

from ...models.command import Leaf
from ...models.config import ProgramConfig
from ...models.program import Program, Route
from ..command.compile import LLMS_PARAM, apply_route_config, create_llms_option
from ..command.manifest import build_manifest


def compile_program(program: Program, router: Mapping[str, Route], config: ProgramConfig):
    """Wire a program: mount each route under its router key, apply the shared config and
    add `--llms`, which prints the manifest of every leaf below."""
    program.aliases = tuple(config.get("aliases", ()))
    program.help_group = config.get("help_group")
    program.error_renderer = config.get("render_error")
    program.routes = {}
    for key, route in router.items():
        if not isinstance(route, Leaf | Program):
            raise TypeError(f"route '{key}' is not a fireargs command or program")
        program.routes[key] = route
        program.add_command(route, key)
    apply_route_config(program, config)

    llms_option = config.get("llms_option", True)
    if llms_option is not False:
        program.params.append(
            create_llms_option(
                llms_option,
                "print the program manifest (subcommand schemas) as JSON for LLM tool-use",
            )
        )

    def invoke(**params: object):
        ctx = click.get_current_context()
        if params.get(LLMS_PARAM):
            click.echo(
                json.dumps(build_manifest(program, ""), indent=2, ensure_ascii=False)
            )
            ctx.exit()
        if ctx.invoked_subcommand is None:
            click.echo(ctx.get_help())

    program.callback = invoke
