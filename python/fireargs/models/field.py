from collections.abc import Callable, Mapping
from dataclasses import dataclass, field
from typing import Literal


@dataclass(frozen=True, kw_only=True)
class ArgumentMeta:
    """Fireargs' config for a positional field, stored in the field's pydantic metadata."""

    kind: Literal["argument"] = "argument"
    name: str | None = None
    parse: Callable[[str], object] | None = None
    default_description: str | None = None
    envvar: str | list[str] | None = None
    metavar: str | None = None


@dataclass(frozen=True, kw_only=True)
class OptionMeta:
    """Fireargs' config for a `--flag` field, stored in the field's pydantic metadata."""

    kind: Literal["option"] = "option"
    name: str | None = None
    short: str | None = None
    parse: Callable[[str], object] | None = None
    default_description: str | None = None
    help_group: str | None = None
    conflicts: tuple[str, ...] = ()
    implies: Mapping[str, object] = field(default_factory=dict)
    envvar: str | list[str] | None = None
    show_envvar: bool = False
    hidden: bool = False
    flag_value: object = None
    is_flag: bool | None = None
    show_default: bool | str | None = None
    metavar: str | None = None
    count: bool = False
    prompt: bool | str = False
    hide_input: bool = False
    confirmation_prompt: bool | str = False


type FieldMeta = ArgumentMeta | OptionMeta
