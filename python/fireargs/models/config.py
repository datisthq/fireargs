from collections.abc import Callable, Mapping
from typing import TypedDict

from .context import Context


class FieldConfig(TypedDict, total=False):
    """The pydantic `Field()` settings `Argument` and `Option` accept."""

    default: object
    default_factory: Callable[[], object]
    alias: str
    title: str
    description: str
    examples: list[object]
    gt: float
    ge: float
    lt: float
    le: float
    multiple_of: float
    min_length: int
    max_length: int
    pattern: str
    strict: bool
    deprecated: str | bool


class ArgumentConfig(FieldConfig, total=False):
    """Config for `Argument()`: pydantic settings, fireargs' own and click's `Argument`."""

    name: str
    parse: Callable[[str], object]
    default_description: str
    envvar: str | list[str]
    metavar: str


class OptionConfig(FieldConfig, total=False):
    """Config for `Option()`: pydantic settings, fireargs' own and click's `Option`."""

    name: str
    short: str
    parse: Callable[[str], object]
    default_description: str
    help_group: str
    conflicts: str | list[str]
    implies: Mapping[str, object]
    envvar: str | list[str]
    show_envvar: bool
    hidden: bool
    flag_value: object
    is_flag: bool
    show_default: bool | str
    metavar: str
    count: bool
    prompt: bool | str
    hide_input: bool
    confirmation_prompt: bool | str


class FlagConfig(TypedDict, total=False):
    """Customise a built-in flag: `flags` like `"-j, --json"` and its help text."""

    flags: str
    description: str


class RouteConfig(TypedDict, total=False):
    """Config shared by commands and programs: fireargs' own and click's `Command`."""

    name: str
    description: str
    aliases: list[str]
    help_group: str
    version: str
    version_option: FlagConfig
    llms_option: FlagConfig | bool
    render_error: Callable[[Exception, Context], object]
    context_settings: Mapping[str, object]
    epilog: str
    short_help: str
    options_metavar: str
    add_help_option: bool
    no_args_is_help: bool
    hidden: bool
    deprecated: bool | str


class CommandConfig(RouteConfig, total=False):
    """Config for `@command(...)`."""

    json_option: FlagConfig | bool


class ProgramConfig(RouteConfig, total=False):
    """Config for `Program(...)`, besides its `router`."""
