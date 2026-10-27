import json
from collections.abc import Mapping, Sequence
from dataclasses import dataclass, field

import click
from pydantic import ValidationError
from pydantic_core import ErrorDetails

from ...models.command import FieldSpec
from ...models.field import OptionMeta


class CliValueError(Exception):
    """A CLI string a field's `parse` or number parsing rejected, before validation;
    `env` names the env var it came from."""

    def __init__(
        self, spec: FieldSpec, value: str, message: str, env: str | None = None
    ) -> None:
        super().__init__(message)
        self.spec = spec
        self.value = value
        self.message = message
        self.env = env


@dataclass(frozen=True)
class CliInput:
    """Argv input as converted for validation (`values`), as typed (`tokens`), and the
    env var each key read from the environment came from (`envs`)."""

    values: Mapping[str, object]
    tokens: Mapping[str, object] = field(default_factory=dict)
    envs: Mapping[str, str] = field(default_factory=dict)


def report_input_error(
    ctx: click.Context,
    error: Exception,
    fields: Sequence[FieldSpec],
    raw: CliInput | None,
):
    """Report a failed input parse worded like commander's own parse errors, on stderr
    with exit code 1. `raw` is the CLI input, or `None` for `--json` input. Anything other
    than a JSON, CLI value or validation failure is re-raised."""
    if isinstance(error, json.JSONDecodeError):
        fail_input(ctx, f"error: --json value is not valid JSON: {error}")
    if isinstance(error, CliValueError):
        line = format_value_error(error.spec, error.value, error.message, error.env)
        fail_input(ctx, line)
    if not isinstance(error, ValidationError):
        raise error

    issues = error.errors(include_url=False)
    if raw is None:
        lines = [format_json_issue(issue) for issue in issues]
    else:
        lines = [
            format_cli_issue(issue, fields, raw) for issue in pick_first_issues(issues)
        ]
    fail_input(ctx, "\n".join(lines))


def fail_input(ctx: click.Context, message: str):
    """Print an input error to stderr and exit with code 1, as commander's `error()` does."""
    click.echo(message, err=True)
    ctx.exit(1)


def pick_first_issues(issues: Sequence[ErrorDetails]):
    seen: set[str | int] = set()
    picked: list[ErrorDetails] = []
    for issue in issues:
        key = issue["loc"][0] if issue["loc"] else None
        if key is not None and key in seen:
            continue
        if key is not None:
            seen.add(key)
        picked.append(issue)
    return picked


def format_json_issue(issue: ErrorDetails):
    path = "".join(
        f"[{part}]" if isinstance(part, int) else f".{part}" for part in issue["loc"]
    ).lstrip(".")
    if not path:
        return f"error: invalid --json input: {issue['msg']}"
    return f"error: invalid --json input at '{path}': {issue['msg']}"


def format_cli_issue(issue: ErrorDetails, fields: Sequence[FieldSpec], raw: CliInput):
    key = issue["loc"][0] if issue["loc"] else None
    spec = next((spec for spec in fields if spec.key == key), None)
    if spec is None:
        return f"error: invalid input. {issue['msg']}"

    value = raw.values.get(spec.key)
    if value is None and spec.key not in raw.values:
        if spec.kind == "argument":
            return f"error: missing required argument '{spec.name}'"
        return f"error: required option '{spec.flags}' not specified"
    index = issue["loc"][1] if len(issue["loc"]) > 1 else None
    # Quote what was typed: `--count 03`, not the `3` it converted to
    token = raw.tokens.get(spec.key, value)
    if isinstance(token, tuple) and isinstance(value, list) and len(token) == len(value):
        token = list(token)
    elif isinstance(token, tuple):
        token = " ".join(token)
    shown = format_issue_value(token, index)
    return format_value_error(spec, shown, issue["msg"], raw.envs.get(spec.key))


def format_value_error(spec: FieldSpec, value: str, message: str, env: str | None = None):
    # A `hide_input` value is a secret: mask it, also where the message quotes it
    if isinstance(spec.meta, OptionMeta) and spec.meta.hide_input:
        message = message.replace(value, "***") if value else message
        value = "***"
    if spec.kind == "argument":
        return f"error: command-argument value '{value}' is invalid for argument '{spec.name}'. {message}"
    if env is not None:
        return f"error: option '{spec.flags}' value '{value}' from env '{env}' is invalid. {message}"
    return f"error: option '{spec.flags}' argument '{value}' is invalid. {message}"


def format_issue_value(value: object, index: str | int | None):
    if isinstance(value, list):
        if isinstance(index, int) and index < len(value):
            return format_scalar(value[index])
        return " ".join(format_scalar(item) for item in value)
    return format_scalar(value)


def format_scalar(value: object):
    if isinstance(value, bool):
        return "true" if value else "false"
    return str(value)
