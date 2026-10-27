import json
from collections.abc import Mapping
from typing import Annotated, Literal

import click
import pytest
from pydantic import BaseModel, Field, ValidationError
from pydantic_core import InitErrorDetails, PydanticCustomError

from fireargs.models.command import FieldSpec
from fireargs.models.field import OptionMeta

from .report import CliInput, report_input_error


def report(
    error: Exception,
    fields: list[FieldSpec] | None = None,
    raw: Mapping[str, object] | None = None,
):
    with pytest.raises(click.exceptions.Exit) as exit:
        cli = None if raw is None else CliInput(values=raw)
        report_input_error(click.Context(click.Command("test")), error, fields or [], cli)
    assert exit.value.exit_code == 1


def make_field(
    key: str,
    kind: Literal["argument", "option"],
    name: str,
    flags: str | None = None,
    meta: OptionMeta | None = None,
) -> FieldSpec:
    return FieldSpec(
        key=key,
        kind=kind,
        name=name,
        flags=flags or name,
        description=None,
        required=True,
        variadic=False,
        parse=None,
        meta=meta,
    )


def read_error(model: type[BaseModel], value: object) -> ValidationError:
    with pytest.raises(ValidationError) as error:
        model.model_validate(value)
    return error.value


def read_json_error(value: str) -> json.JSONDecodeError:
    with pytest.raises(json.JSONDecodeError) as error:
        json.loads(value)
    return error.value


class TestReportInputError:
    def test_reports_a_json_value_that_is_not_json(
        self, capsys: pytest.CaptureFixture[str]
    ):
        report(read_json_error("{bad"))
        assert capsys.readouterr().err.startswith(
            "error: --json value is not valid JSON: "
        )

    def test_reraises_an_error_that_is_not_an_input_failure(self):
        error = RuntimeError("boom")
        with pytest.raises(RuntimeError) as raised:
            report_input_error(click.Context(click.Command("test")), error, [], None)
        assert raised.value is error

    def test_words_a_missing_and_an_invalid_positional_like_commander_by_its_cli_name(
        self, capsys: pytest.CaptureFixture[str]
    ):
        class Text(BaseModel):
            file_path: str

        class Number(BaseModel):
            file_path: int

        fields = [make_field("file_path", "argument", "file-path")]

        report(read_error(Text, {}), fields, {})
        assert capsys.readouterr().err == "error: missing required argument 'file-path'\n"

        raw = {"file_path": "big"}
        report(read_error(Number, raw), fields, raw)
        assert capsys.readouterr().err == (
            "error: command-argument value 'big' is invalid for argument 'file-path'. "
            "Input should be a valid integer, unable to parse string as an integer\n"
        )

    def test_shows_the_offending_element_of_a_variadic_positional(
        self, capsys: pytest.CaptureFixture[str]
    ):
        class In(BaseModel):
            sizes: list[int]

        raw = {"sizes": ["1", "big"]}
        report(read_error(In, raw), [make_field("sizes", "argument", "sizes")], raw)
        assert capsys.readouterr().err.startswith(
            "error: command-argument value 'big' is invalid for argument 'sizes'."
        )

    def test_names_options_by_their_declared_flags(
        self, capsys: pytest.CaptureFixture[str]
    ):
        class In(BaseModel):
            name: str
            header_rows: int

        fields = [
            make_field("name", "option", "name", "-n, --name <value>"),
            make_field("header_rows", "option", "header-rows", "--header-rows <value>"),
        ]
        raw = {"header_rows": "x"}

        report(read_error(In, raw), fields, raw)
        assert capsys.readouterr().err == (
            "error: required option '-n, --name <value>' not specified\n"
            "error: option '--header-rows <value>' argument 'x' is invalid. "
            "Input should be a valid integer, unable to parse string as an integer\n"
        )

    def test_reports_one_line_per_key_and_keeps_root_issues(
        self, capsys: pytest.CaptureFixture[str]
    ):
        issues: list[InitErrorDetails] = [
            {
                "type": "string_too_short",
                "loc": ("name",),
                "input": "b",
                "ctx": {"min_length": 3},
            },
            {
                "type": "string_pattern_mismatch",
                "loc": ("name",),
                "input": "b",
                "ctx": {"pattern": "^a"},
            },
            {"type": PydanticCustomError("rejected", "Rejected"), "loc": (), "input": {}},
        ]
        raw = {"name": "b"}

        report(
            ValidationError.from_exception_data("In", issues),
            [make_field("name", "argument", "name")],
            raw,
        )
        assert capsys.readouterr().err == (
            "error: command-argument value 'b' is invalid for argument 'name'. "
            "String should have at least 3 characters\n"
            "error: invalid input. Rejected\n"
        )

    def test_reports_every_json_issue_at_its_dotted_path(
        self, capsys: pytest.CaptureFixture[str]
    ):
        class Inner(BaseModel):
            b: list[int]

        class In(BaseModel):
            a: Inner
            c: str

        report(read_error(In, {"a": {"b": ["x"]}}))
        assert capsys.readouterr().err == (
            "error: invalid --json input at 'a.b[0]': "
            "Input should be a valid integer, unable to parse string as an integer\n"
            "error: invalid --json input at 'c': Field required\n"
        )

        report(read_error(In, 1))
        assert capsys.readouterr().err == (
            "error: invalid --json input: Input should be a valid dictionary or instance of In\n"
        )

    def test_exits_with_code_one_writing_to_stderr(
        self, capsys: pytest.CaptureFixture[str]
    ):
        class In(BaseModel):
            c: Annotated[str, Field(min_length=1)]

        report(read_error(In, {}))
        assert "error: invalid --json input at 'c'" in capsys.readouterr().err

    def test_masks_a_hide_input_value_and_keeps_a_constraint_reason(
        self, capsys: pytest.CaptureFixture[str]
    ):
        class In(BaseModel):
            token: Annotated[str, Field(min_length=8)]

        meta = OptionMeta(hide_input=True)
        fields = [make_field("token", "option", "token", "--token <value>", meta)]
        raw = {"token": "hunter2"}

        report(read_error(In, raw), fields, raw)
        assert capsys.readouterr().err == (
            "error: option '--token <value>' argument '***' is invalid. "
            "String should have at least 8 characters\n"
        )
