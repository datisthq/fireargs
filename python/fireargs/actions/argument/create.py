from typing import Unpack

from ...models.config import ArgumentConfig
from ...models.field import ArgumentMeta
from ..field.write import write_field_meta


def create_argument(**config: Unpack[ArgumentConfig]):
    """Declare a positional argument: a pydantic `Field()` that also carries its CLI config.
    Use it in `Annotated[T, Argument(...)]`."""
    meta = ArgumentMeta(
        name=config.get("name"),
        parse=config.get("parse"),
        default_description=config.get("default_description"),
        envvar=config.get("envvar"),
        metavar=config.get("metavar"),
    )
    return write_field_meta(config, meta)
