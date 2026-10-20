import json
from collections.abc import Mapping, Sequence

import click
from pydantic import ValidationError
from pydantic_core import ErrorDetails

from ...models.command import FieldSpec
from ...models.field import OptionMeta


class CliValueError(Exception):
    """A CLI string a field's `parse` or number parsing rejected, before validation."""

    def __init__(self, spec: FieldSpec, value: str, message: str) -> None:
        super().__init__(message)
        self.spec = spec
        self.value = value
        self.message = message


def report_input_error(
    ctx: click.Context,
    error: Exception,
    fields: Sequence[FieldSpec],
    raw: Mapping[str, object] | None,
):
    """Report a failed input parse worded like commander's own parse errors, on stderr
    with exit code 1. `raw` is the CLI input, or `None` for `--json` input. Anything other
    than a JSON, CLI value or validation failure is re-raised."""
    if isinstance(error, json.JSONDecodeError):
        fail_input(ctx, f"error: --json value is not valid JSON: {error}")
    if isinstance(error, CliValueError):
        fail_input(ctx, format_value_error(error.spec, error.value, error.message))
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


def format_cli_issue(
    issue: ErrorDetails, fields: Sequence[FieldSpec], raw: Mapping[str, object]
):
    key = issue["loc"][0] if issue["loc"] else None
    spec = next((spec for spec in fields if spec.key == key), None)
    if spec is None:
        return f"error: invalid input. {issue['msg']}"

    value = raw.get(spec.key)
    if value is None and spec.key not in raw:
        if spec.kind == "argument":
            return f"error: missing required argument '{spec.name}'"
        return f"error: required option '{spec.flags}' not specified"
    index = issue["loc"][1] if len(issue["loc"]) > 1 else None
    return format_value_error(spec, format_issue_value(value, index), issue["msg"])


def format_value_error(spec: FieldSpec, value: str, message: str):
    # A `hide_input` value is a secret: never echo it, nor a message that may quote it
    if isinstance(spec.meta, OptionMeta) and spec.meta.hide_input:
        return f"error: option '{spec.flags}' argument '***' is invalid."
    if spec.kind == "argument":
        return f"error: command-argument value '{value}' is invalid for argument '{spec.name}'. {message}"
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
