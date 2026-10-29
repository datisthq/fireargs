import json
import math
import os
import re
import types
from collections.abc import Awaitable, Callable, Mapping, Sequence
from dataclasses import dataclass
from enum import Enum
from typing import Annotated, Literal, TypedDict, Union, get_args, get_origin

import click
from click.core import ParameterSource
from pydantic import BaseModel, TypeAdapter, ValidationError
from pydantic.fields import FieldInfo
from pydantic_core import InitErrorDetails, PydanticUndefined

from ...models.command import Command, FieldOption, FieldSpec, Leaf, ValueType
from ...models.config import CommandConfig, FlagConfig, RouteConfig
from ...models.context import Context, RenderContext
from ...models.field import ArgumentMeta, OptionMeta
from ..awaitable.run import run_awaitable
from ..context.accept import accepts_context
from ..error.handle import find_error_handler, handle_error
from ..field.read import read_field_meta
from ..route.read import read_route_path
from .manifest import build_manifest
from .report import CliInput, CliValueError, fail_input, report_input_error

JSON_PARAM = "fireargs_json"
LLMS_PARAM = "fireargs_llms"

# `--json` given without a value; a real JSON value can never equal it
BARE_JSON = "\x00"


def compile_command[I: BaseModel, O](
    config: CommandConfig,
    handler: Callable[..., O | Awaitable[O]],
    input: type[I],
    output: TypeAdapter[O],
    takes_context: bool,
) -> Command[I, O]:
    """Build a fully wired `Command` from a handler and its input and output types:
    declare an argument or option per input field, `--json` and `--llms`, and a callback
    that validates input, runs the handler, validates its result and prints it as JSON or
    through the command's render."""
    name = config.get("name") or derive_cli_name(
        getattr(handler, "__name__", "command"), None
    )
    command: Command[I, O] = Command(
        name,
        help=config.get("description"),
        epilog=config.get("epilog"),
        short_help=config.get("short_help"),
        options_metavar=config.get("options_metavar", "[OPTIONS]"),
        add_help_option=config.get("add_help_option", True),
        no_args_is_help=config.get("no_args_is_help", False),
        hidden=config.get("hidden", False),
        deprecated=config.get("deprecated", False),
        context_settings=dict(config.get("context_settings", {})),
    )
    command.handler = handler
    command.takes_context = takes_context
    command.input = input
    command.output = output
    apply_route_config(command, config)

    specs, params = declare_fields(input)
    command.fields = tuple(specs)
    command.params.extend(params)
    json_option = config.get("json_option", True)
    if json_option is not False:
        command.json_param = JSON_PARAM
        command.params.append(create_json_option(json_option))
    llms_option = config.get("llms_option", True)
    if llms_option is not False:
        command.llms_param = LLMS_PARAM
        command.params.append(
            create_llms_option(
                llms_option,
                "print this command's schema (name, input, output) as JSON for LLM tool-use",
            )
        )
    assert_unique_flags(command)

    def invoke(**params: object):
        run_command(command, click.get_current_context())

    command.callback = invoke
    return command


def apply_route_config(route: Leaf | click.Group, config: RouteConfig):
    """Apply the config commands and programs share: aliases, help group, `render_error`
    and `version`."""
    if isinstance(route, Leaf):
        route.aliases = tuple(config.get("aliases", ()))
        route.help_group = config.get("help_group")
        route.error_renderer = config.get("render_error")
    version = config.get("version")
    if version is not None:
        route.params.append(
            create_version_option(version, config.get("version_option", {}))
        )


def derive_cli_name(key: str, name: str | None):
    """Turn an input key into its CLI name: `header_rows` and `headerRows` become
    `header-rows`; an explicit `name` wins."""
    if name is not None:
        return name
    kebab = re.sub(r"([a-z0-9])([A-Z])", r"\1-\2", key.strip("_"))
    kebab = re.sub(r"([A-Z])([A-Z][a-z])", r"\1-\2", kebab)
    return kebab.replace("_", "-").lower()


def create_json_option(config: FlagConfig | bool):
    flags = config.get("flags", "--json") if isinstance(config, dict) else "--json"
    description = (
        config.get("description") if isinstance(config, dict) else None
    ) or "write output as JSON; pass a JSON string to also drive input"
    return FieldOption(
        [*split_flags(flags), JSON_PARAM],
        is_flag=False,
        flag_value=BARE_JSON,
        default=None,
        metavar="[value]",
        help=description,
    )


def create_llms_option(config: FlagConfig | bool, fallback: str):
    """Build the `--llms` flag; customise its flags and help with a `FlagConfig`."""
    flags = config.get("flags", "--llms") if isinstance(config, dict) else "--llms"
    description = (config.get("description") if isinstance(config, dict) else None) or (
        fallback
    )
    return FieldOption(
        [*split_flags(flags), LLMS_PARAM], is_flag=True, default=False, help=description
    )


def create_version_option(version: str, config: FlagConfig):
    def print_version(ctx: click.Context, param: click.Parameter, value: bool):
        if value and not ctx.resilient_parsing:
            click.echo(version)
            ctx.exit()

    return click.Option(
        split_flags(config.get("flags", "-V, --version")),
        is_flag=True,
        expose_value=False,
        is_eager=True,
        callback=print_version,
        help=config.get("description", "output the version number"),
    )


def split_flags(flags: str):
    return [flag.strip() for flag in flags.split(",") if flag.strip()]


def assert_unique_flags(command: click.Command):
    seen: set[str] = set()
    for param in command.params:
        for flag in [*param.opts, *param.secondary_opts]:
            if flag.startswith("-") and flag in seen:
                raise ValueError(
                    f"Cannot add option '{', '.join(param.opts)}' to command "
                    f"'{command.name}' due to conflicting flag '{flag}'"
                )
            seen.add(flag)


class OptionSettings(TypedDict):
    show_default: bool | str
    help: str | None
    envvar: str | list[str] | None
    show_envvar: bool
    hidden: bool
    prompt: bool | str
    hide_input: bool
    confirmation_prompt: bool | str


@dataclass(frozen=True)
class ValueShape:
    boolean: bool
    variadic: bool
    element: ValueType
    items: tuple[ValueType, ...] | None = None


def declare_fields(input: type[BaseModel]):
    specs: list[FieldSpec] = []
    params: list[click.Parameter] = []
    fields = list(input.model_fields.items())
    for key, info in fields:
        meta = read_field_meta(info)
        if isinstance(meta, ArgumentMeta):
            spec, param = declare_argument(key, info, meta)
            specs.append(spec)
            params.append(param)
    for key, info in fields:
        meta = read_field_meta(info)
        if not isinstance(meta, ArgumentMeta):
            spec, param = declare_option(key, info, meta)
            specs.append(spec)
            params.append(param)
    return specs, params


def read_field_alias(info: FieldInfo):
    if isinstance(info.validation_alias, str):
        return info.validation_alias
    return info.alias


def declare_argument(key: str, info: FieldInfo, meta: ArgumentMeta):
    shape = read_value_shape(info.annotation, meta.parse)
    name = derive_cli_name(key, meta.name)
    required = info.is_required()
    label = f"{name}..." if shape.variadic else name
    spec = FieldSpec(
        key=key,
        alias=read_field_alias(info),
        kind="argument",
        name=name,
        flags=name,
        description=info.description,
        default=meta.default_description or read_click_default(info, False),
        required=required,
        variadic=shape.variadic,
        element=shape.element,
        items=shape.items,
        parse=meta.parse,
        meta=meta,
    )
    argument = click.Argument(
        [key],
        required=False,
        nargs=-1 if shape.variadic else 1,
        envvar=meta.envvar,
        metavar=meta.metavar or (f"<{label}>" if required else f"[{label}]"),
    )
    return spec, argument


def declare_option(key: str, info: FieldInfo, meta: OptionMeta | None):
    meta = meta or OptionMeta()
    shape = read_value_shape(info.annotation, meta.parse)
    name = derive_cli_name(key, meta.name)
    short = f"-{meta.short}" if meta.short else None
    flag = shape.boolean and meta.flag_value is None
    preset = meta.flag_value is not None and not flag and not meta.is_flag
    default = read_click_default(info, shape.variadic)
    long = f"--{name}"
    if flag and default is True and not name.startswith("no-"):
        long = f"--{name}/--no-{name}"
    decls = [*([short] if short else []), long, key]
    value = (
        ""
        if flag or meta.count or meta.is_flag
        else "[value]"
        if preset
        else "<value...>"
        if shape.variadic
        else "<value>"
    )
    spec = FieldSpec(
        key=key,
        alias=read_field_alias(info),
        kind="option",
        name=name,
        flags=" ".join(
            part for part in [", ".join([*decls[:-2], f"--{name}"]), value] if part
        ),
        description=info.description,
        default=None,
        required=info.is_required(),
        variadic=shape.variadic,
        element=shape.element,
        items=shape.items,
        parse=meta.parse,
        meta=meta,
    )
    show_default = meta.show_default
    # Shown as commander shows it: lowercase, and a false default too
    shown_flag_default = None
    if show_default is None and flag and isinstance(info.get_default(), bool):
        shown_flag_default = "true" if default else "false"
        show_default = False
    elif show_default is None:
        show_default = meta.default_description or default is not None
    shared: OptionSettings = {
        "show_default": show_default,
        "help": info.description,
        "envvar": meta.envvar,
        "show_envvar": meta.show_envvar,
        "hidden": meta.hidden,
        "prompt": meta.prompt,
        "hide_input": meta.hide_input,
        "confirmation_prompt": meta.confirmation_prompt,
    }
    if flag:
        option = FieldOption(
            decls,
            is_flag=True,
            flag_value=True,
            default=default if isinstance(default, bool) else None,
            count=meta.count,
            metavar=meta.metavar,
            **shared,
        )
        option.boolean_flags = spec.flags
        option.shown_default = shown_flag_default
    elif meta.is_flag and meta.flag_value is not None:
        option = FieldOption(
            decls, is_flag=True, flag_value=meta.flag_value, default=default, **shared
        )
    elif preset:
        option = FieldOption(
            decls,
            is_flag=False,
            flag_value=meta.flag_value,
            default=default,
            metavar=meta.metavar or value,
            **shared,
        )
    else:
        # click.Choice would reject a token in click's words, with exit code 2
        choices = shape.element.choices
        option = FieldOption(
            decls,
            multiple=shape.variadic,
            is_flag=meta.is_flag,
            default=default,
            count=meta.count,
            metavar=meta.metavar or (f"[{'|'.join(choices)}]" if choices else "<value>"),
            **shared,
        )
    option.help_group = meta.help_group
    return spec, option


def read_click_default(info: FieldInfo, variadic: bool):
    """The field's default as click shows it; click's value is never read back, since a
    defaulted field is left for pydantic to fill."""
    default = info.get_default(call_default_factory=True)
    if default is PydanticUndefined or default is None:
        return None
    if isinstance(default, bool):
        return default if default else None
    if variadic and isinstance(default, list | tuple | set | frozenset):
        return tuple(format_default(item) for item in default) or None
    return format_default(default)


def format_default(value: object):
    return str(value.value) if isinstance(value, Enum) else str(value)


def read_value_shape(annotation: object, parse: Callable[[str], object] | None):
    if parse is not None:
        return ValueShape(boolean=False, variadic=False, element=ValueType())
    inner = unwrap_annotation(annotation)
    origin = get_origin(inner)
    args = get_args(inner)
    if origin is tuple and not (len(args) == 2 and args[1] is Ellipsis):
        items = tuple(read_value_type(arg) for arg in args)
        return ValueShape(boolean=False, variadic=True, element=ValueType(), items=items)
    if origin in (list, tuple, set, frozenset):
        element = read_value_type(args[0]) if args else ValueType()
        return ValueShape(boolean=False, variadic=True, element=element)
    return ValueShape(
        boolean=inner is bool, variadic=False, element=read_value_type(inner)
    )


def read_value_type(annotation: object):
    inner = unwrap_annotation(annotation)
    if is_number(inner):
        return ValueType(number=True)
    values = read_choice_values(inner)
    if values is None:
        return ValueType()
    choices = tuple(
        value if isinstance(value, str) else json.dumps(value) for value in values
    )
    return ValueType(choices=choices, values=values)


def unwrap_annotation(annotation: object):
    current = annotation
    while True:
        origin = get_origin(current)
        if origin is Annotated:
            current = get_args(current)[0]
        elif origin is Union or origin is types.UnionType:
            members = [arg for arg in get_args(current) if arg is not type(None)]
            if len(members) != 1:
                return current
            current = members[0]
        else:
            return current


def read_union_members(annotation: object):
    if get_origin(annotation) not in (Union, types.UnionType):
        return None
    return [
        unwrap_annotation(arg) for arg in get_args(annotation) if arg is not type(None)
    ]


def is_number(annotation: object):
    members = read_union_members(annotation)
    if members is not None:
        return all(member is int or member is float for member in members)
    return annotation is int or annotation is float


def read_choice_values(annotation: object) -> tuple[object, ...] | None:
    members = read_union_members(annotation)
    if members is not None:
        groups = [read_choice_values(member) for member in members]
        if any(group is None for group in groups):
            return None
        return tuple(value for group in groups for value in group or ())
    if get_origin(annotation) is Literal:
        values = get_args(annotation)
    elif isinstance(annotation, type) and issubclass(annotation, Enum):
        values = tuple(member.value for member in annotation)
    else:
        return None
    values = tuple(value for value in values if value is not None)
    if values and all(isinstance(value, str | int | float) for value in values):
        return values
    return None


def run_command[I: BaseModel, O](command: Command[I, O], ctx: click.Context):
    """Run a leaf: print the manifest for `--llms`, else read input from `--json <value>`
    or argv, validate it, call the handler, validate and print its result."""
    params = ctx.params
    if command.llms_param is not None and params.get(command.llms_param):
        prefix = read_route_path(ctx) or command.name or ""
        manifest = build_manifest(command, prefix, ctx.parent is None)
        click.echo(json.dumps(manifest, indent=2, ensure_ascii=False))
        return

    json_value = params.get(command.json_param) if command.json_param else None
    json_input = (
        json_value if isinstance(json_value, str) and json_value != BARE_JSON else None
    )
    context = Context(json=json_value is not None, command=command)
    provided = read_provided_keys(command, ctx)
    check_conflicts(ctx, command.fields, provided)
    if json_input is None:
        check_required_arguments(ctx, command.fields, params)

    raw: CliInput | None = None
    try:
        if json_input is not None:
            data = json.dumps(load_json(json_input))
            # Strict, as zod is: `--json` carries typed values, so `"3"` is no number
            parsed = command.input.model_validate_json(data, strict=True)
        else:
            envs = read_env_sources(command.fields, ctx)
            values = read_cli_input(command.fields, params, provided, envs)
            tokens = {key: params[key] for key in provided}
            raw = CliInput(values=values, tokens=tokens, envs=envs)
            parsed = command.input.model_validate(values, by_alias=True, by_name=True)
    except (json.JSONDecodeError, CliValueError, ValidationError) as error:
        # A CLI value commander rejects at parse time never reaches the TS hook either
        if isinstance(error, CliValueError) or find_error_handler(ctx) is None:
            report_input_error(ctx, error, command.fields, raw)
        handle_error(ctx, error, context)
        return

    try:
        args = (parsed, context) if command.takes_context else (parsed,)
        validated = command.output.validate_python(run_awaitable(command.handler(*args)))
        # A render-only output may hold what JSON mode cannot serialize
        mode = "json" if context.json else "python"
        dumped = command.output.dump_python(validated, mode=mode, by_alias=True)
        check_finite_output(dumped)
        if context.json:
            dumped = drop_unset_optionals(validated, dumped)
            click.echo(json.dumps(dumped, indent=2, ensure_ascii=False))
            return
        if command.renderer is not None:
            renderer = command.renderer
            if accepts_context(renderer):
                context = RenderContext(json=False, command=command, input=parsed)
                rendered = run_awaitable(renderer(validated, context))
            else:
                rendered = run_awaitable(renderer(validated))
            if isinstance(rendered, str):
                click.echo(rendered)
    except (click.exceptions.Exit, click.ClickException):
        raise
    except Exception as error:
        handle_error(ctx, error, context)


def load_json(text: str):
    """Parse `--json` input as RFC 8259 JSON: `NaN`, `Infinity` and a number out of a
    float's range are not JSON. An integral float reads as an int, as zod takes `3.0`."""

    def reject(token: str):
        raise json.JSONDecodeError(
            f"{token} is not a JSON number", text, max(text.find(token), 0)
        )

    def read_float(token: str):
        number = float(token)
        if not math.isfinite(number):
            reject(token)
        return int(number) if number.is_integer() else number

    return json.loads(text, parse_constant=reject, parse_float=read_float)


def check_finite_output(value: object, path: tuple[str | int, ...] = ()):
    """Raise a `ValidationError` at the first non-finite number in dumped output: JSON
    cannot hold it, and `json.dumps` would write `NaN`."""
    if isinstance(value, float) and not math.isfinite(value):
        error: InitErrorDetails = {"type": "finite_number", "loc": path, "input": value}
        raise ValidationError.from_exception_data("output", [error])
    if isinstance(value, dict):
        for key, item in value.items():
            check_finite_output(item, (*path, str(key)))
    elif isinstance(value, list | tuple):
        for index, item in enumerate(value):
            check_finite_output(item, (*path, index))


def read_provided_keys(command: Leaf, ctx: click.Context):
    provided: set[str] = set()
    for spec in command.fields:
        source = ctx.get_parameter_source(spec.key)
        if source is not None and source is not ParameterSource.DEFAULT:
            value = ctx.params.get(spec.key)
            if value is not None and value != ():
                provided.add(spec.key)
    return provided


def check_conflicts(ctx: click.Context, fields: Sequence[FieldSpec], provided: set[str]):
    for spec in fields:
        if spec.key not in provided or not isinstance(spec.meta, OptionMeta):
            continue
        for other in spec.meta.conflicts:
            if other in provided:
                other_flags = next((s.flags for s in fields if s.key == other), other)
                fail_input(
                    ctx,
                    f"error: option '{spec.flags}' cannot be used with option '{other_flags}'",
                )


def check_required_arguments(
    ctx: click.Context, fields: Sequence[FieldSpec], params: dict[str, object]
):
    for spec in fields:
        if (
            spec.kind == "argument"
            and spec.required
            and params.get(spec.key) in (None, ())
        ):
            fail_input(ctx, f"error: missing required argument '{spec.name}'")


def read_env_sources(fields: Sequence[FieldSpec], ctx: click.Context):
    """The env var each key's value came from, for the keys read from the environment."""
    envs: dict[str, str] = {}
    for spec in fields:
        if ctx.get_parameter_source(spec.key) is not ParameterSource.ENVIRONMENT:
            continue
        env = read_env_name(spec.meta.envvar if spec.meta is not None else None)
        if env is not None:
            envs[spec.key] = env
    return envs


def read_env_name(envvar: str | Sequence[str] | None):
    """The env var a value is read from: the first of `envvar` set and not empty."""
    names = [envvar] if isinstance(envvar, str) else list(envvar or [])
    return next((name for name in names if os.environ.get(name)), None)


def read_cli_input(
    fields: Sequence[FieldSpec],
    params: dict[str, object],
    provided: set[str],
    envs: Mapping[str, str],
):
    raw: dict[str, object] = {}
    for spec in fields:
        if spec.key not in provided:
            continue
        value = params[spec.key]
        env = envs.get(spec.key)
        if isinstance(value, tuple):
            raw[spec.key] = [
                convert_value(spec, item, index, env) for index, item in enumerate(value)
            ]
        else:
            raw[spec.key] = convert_value(spec, value, 0, env)
    for spec in fields:
        if spec.key in provided and isinstance(spec.meta, OptionMeta):
            for key, value in spec.meta.implies.items():
                if key not in provided:
                    raw[key] = value
    return raw


def convert_value(spec: FieldSpec, value: object, index: int, env: str | None = None):
    if not isinstance(value, str):
        return value
    try:
        if spec.parse is not None:
            return spec.parse(value)
        return convert_token(read_value_type_at(spec, index), value)
    except Exception as error:
        raise CliValueError(spec, value, str(error), env) from error


def read_value_type_at(spec: FieldSpec, index: int):
    if spec.items is None:
        return spec.element
    return spec.items[index] if index < len(spec.items) else ValueType()


def convert_token(value_type: ValueType, value: str):
    if value_type.number:
        return parse_number(value)
    choices = value_type.choices
    if choices is None:
        return value
    if value not in choices:
        raise ValueError(f"Allowed choices are {', '.join(choices)}.")
    return value_type.values[choices.index(value)]


# Shared by every twin: no hex, no digit separators, no `inf` or `nan`
NUMBER = re.compile(r"[+-]?([0-9]+\.?[0-9]*|\.[0-9]+)([eE][+-]?[0-9]+)?")
INTEGER = re.compile(r"[+-]?[0-9]+")


def parse_number(value: str):
    text = value.strip(" \t\n\f\r")
    if INTEGER.fullmatch(text):
        return int(text)
    number = float(text) if NUMBER.fullmatch(text) else math.nan
    if not math.isfinite(number):
        raise ValueError("Not a number.")
    return int(number) if number.is_integer() else number


def drop_unset_optionals(value: object, dumped: object) -> object:
    """Drop the `None` of each `X | None = None` field from dumped output: that spelling
    is Python's optional, which the TypeScript twin leaves out rather than writing null."""
    if isinstance(value, BaseModel) and isinstance(dumped, dict):
        fields = {
            info.serialization_alias or info.alias or name: (name, info)
            for name, info in type(value).model_fields.items()
        }
        result: dict[str, object] = {}
        for key, item in dumped.items():
            if key not in fields:
                result[key] = item
                continue
            name, info = fields[key]
            field = getattr(value, name)
            if field is None and info.default is None:
                continue
            result[key] = drop_unset_optionals(field, item)
        return result
    if isinstance(value, list | tuple) and isinstance(dumped, list):
        return [drop_unset_optionals(v, d) for v, d in zip(value, dumped, strict=False)]
    if isinstance(value, dict) and isinstance(dumped, dict):
        return {k: drop_unset_optionals(value.get(k), d) for k, d in dumped.items()}
    return dumped
