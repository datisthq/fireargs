from pydantic import Field
from pydantic.fields import FieldInfo
from pydantic_core import PydanticUndefined

from ...models.config import FieldConfig
from ...models.field import FieldMeta


def write_field_meta(config: FieldConfig, meta: FieldMeta):
    """Build a pydantic `Field()` from the pydantic half of a field config and append the
    fireargs meta to its metadata, where `read_field_meta` finds it."""
    info = Field(
        config.get("default", PydanticUndefined),
        default_factory=config.get("default_factory"),
        alias=config.get("alias"),
        title=config.get("title"),
        description=config.get("description"),
        examples=config.get("examples"),
        gt=config.get("gt"),
        ge=config.get("ge"),
        lt=config.get("lt"),
        le=config.get("le"),
        multiple_of=config.get("multiple_of"),
        min_length=config.get("min_length"),
        max_length=config.get("max_length"),
        pattern=config.get("pattern"),
        strict=config.get("strict"),
        deprecated=config.get("deprecated"),
    )
    if not isinstance(info, FieldInfo):
        raise TypeError("pydantic.Field() did not return a FieldInfo")
    info.metadata.append(meta)
    return info
