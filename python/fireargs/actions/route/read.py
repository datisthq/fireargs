import click

from ...models.program import Program


def read_route_path(ctx: click.Context) -> str:
    """Read the space-separated router keys from the root program down to a context's
    command, the root left out: `""` for the root itself."""
    keys: list[str] = []
    while ctx.parent is not None:
        keys.insert(0, read_route_key(ctx.parent.command, ctx.info_name or ""))
        ctx = ctx.parent
    return " ".join(keys)


def read_route_key(parent: click.Command, name: str) -> str:
    """Map the name a route was invoked by, maybe an alias, back to its router key."""
    if isinstance(parent, Program) and name not in parent.routes:
        for key, route in parent.routes.items():
            if name in route.aliases:
                return key
    return name
