from pydantic.fields import FieldInfo

from ...models.field import ArgumentMeta, OptionMeta


def read_field_meta(info: FieldInfo):
    """Read the fireargs meta `Argument()` or `Option()` stored on a field, if any."""
    for item in info.metadata:
        if isinstance(item, ArgumentMeta | OptionMeta):
            return item
    return None
