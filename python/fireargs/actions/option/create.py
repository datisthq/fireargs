from typing import Unpack

from ...models.config import OptionConfig
from ...models.field import OptionMeta
from ..field.write import write_field_meta


def create_option(**config: Unpack[OptionConfig]):
    """Declare a `--flag`: a pydantic `Field()` that also carries its CLI config. Use it in
    `Annotated[T, Option(...)]`; a field without one is an option too."""
    conflicts = config.get("conflicts", ())
    meta = OptionMeta(
        name=config.get("name"),
        short=config.get("short"),
        parse=config.get("parse"),
        default_description=config.get("default_description"),
        help_group=config.get("help_group"),
        conflicts=(conflicts,) if isinstance(conflicts, str) else tuple(conflicts),
        implies=dict(config.get("implies", {})),
        envvar=config.get("envvar"),
        show_envvar=config.get("show_envvar", False),
        hidden=config.get("hidden", False),
        flag_value=config.get("flag_value"),
        is_flag=config.get("is_flag"),
        show_default=config.get("show_default"),
        metavar=config.get("metavar"),
        count=config.get("count", False),
        prompt=config.get("prompt", False),
        hide_input=config.get("hide_input", False),
        confirmation_prompt=config.get("confirmation_prompt", False),
    )
    return write_field_meta(config, meta)
