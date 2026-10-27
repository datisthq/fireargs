import json
from collections.abc import Callable
from typing import Annotated, Literal, TypedDict

import click
import pytest
from click.testing import CliRunner, Result
from pydantic import (
    AfterValidator,
    BaseModel,
    ConfigDict,
    Field,
    ValidationError,
    computed_field,
)

import fireargs as f
from fireargs.actions.field.read import read_field_meta
from fireargs.models.field import OptionMeta

runner = CliRunner()


def invoke(
    command: click.Command, *args: str, env: dict[str, str] | None = None
) -> Result:
    return runner.invoke(command, list(args), env=env)


def read_help(command: click.Command) -> str:
    return invoke(command, "--help").stdout


def read_usage(command: click.Command) -> str:
    return " ".join(command.collect_usage_pieces(click.Context(command)))


def read_leaf_tool(command: click.Command) -> dict[str, dict[str, dict[str, object]]]:
    return json.loads(invoke(command, "--llms").stdout)["tools"][1]


class Empty(BaseModel):
    pass


class Ok(BaseModel):
    ok: bool = True


class Greeting(BaseModel):
    greeting: str


NonNegative = Annotated[int, Field(ge=0)]


class TestCommand:
    def test_returns_a_command_instance(self):
        @f.command(name="greet")
        def greet(input: Empty) -> Empty:
            return input

        assert isinstance(greet, f.Command)
        assert isinstance(greet, click.Command)
        assert greet.name == "greet"

    def test_applies_identity_config_to_the_click_command(self):
        @f.command(
            name="greet",
            description="Greet someone",
            short_help="greet",
            aliases=["hi"],
            version="1.0.0",
        )
        def greet(input: Empty) -> Empty:
            return input

        assert greet.name == "greet"
        assert greet.help == "Greet someone"
        assert greet.short_help == "greet"
        assert greet.aliases == ("hi",)
        assert invoke(greet, "--version").stdout == "1.0.0\n"

    def test_declares_positional_arguments_via_argument(self):
        class In(BaseModel):
            name: Annotated[str, f.Argument()]

        seen: list[In] = []

        @f.command(name="greet")
        def greet(input: In) -> Ok:
            seen.append(input)
            return Ok()

        invoke(greet, "world")
        assert seen == [In(name="world")]

    def test_treats_bare_pydantic_fields_as_options_and_coerces_numbers(self):
        class In(BaseModel):
            count: int

        seen: list[In] = []

        @f.command(name="greet")
        def greet(input: In) -> Ok:
            seen.append(input)
            return Ok()

        invoke(greet, "--count", "5")
        assert seen == [In(count=5)]

    def test_declares_boolean_fields_as_value_less_flags(self):
        class In(BaseModel):
            verbose: bool

        seen: list[In] = []

        @f.command(name="greet")
        def greet(input: In) -> Ok:
            seen.append(input)
            return Ok()

        invoke(greet, "--verbose")
        assert seen == [In(verbose=True)]

    def test_treats_optional_positional_arguments_as_bracketed(self):
        class In(BaseModel):
            name: Annotated[str | None, f.Argument()] = None

        seen: list[In] = []

        @f.command(name="greet")
        def greet(input: In) -> Ok:
            seen.append(input)
            return Ok()

        invoke(greet)
        assert seen[0].model_fields_set == set()
        assert read_usage(greet) == "[OPTIONS] [name]"

    def test_derives_choices_from_a_literal_on_options(self):
        class In(BaseModel):
            kind: Literal["a", "b", "c"]

        seen: list[In] = []

        @f.command(name="greet")
        def greet(input: In) -> Ok:
            seen.append(input)
            return Ok()

        invoke(greet, "--kind", "b")
        assert seen == [In(kind="b")]
        assert invoke(greet, "--kind", "z").exit_code == 2

    def test_derives_choices_from_a_literal_on_positionals(self):
        class In(BaseModel):
            kind: Annotated[Literal["a", "b"], f.Argument()]

        seen: list[In] = []

        @f.command(name="greet")
        def greet(input: In) -> Ok:
            seen.append(input)
            return Ok()

        invoke(greet, "a")
        assert seen == [In(kind="a")]
        assert invoke(greet, "z").exit_code == 2

    def test_fills_pydantic_defaults(self):
        class In(BaseModel):
            port: int = 8080

        seen: list[In] = []

        @f.command(name="greet")
        def greet(input: In) -> Ok:
            seen.append(input)
            return Ok()

        invoke(greet)
        assert seen[0].port == 8080
        assert "[default: 8080]" in read_help(greet)

    def test_treats_list_option_fields_as_a_repeated_flag(self):
        class In(BaseModel):
            files: list[str]

        seen: list[In] = []

        @f.command(name="greet")
        def greet(input: In) -> Ok:
            seen.append(input)
            return Ok()

        invoke(greet, "--files", "a", "--files", "b", "--files", "c")
        assert seen == [In(files=["a", "b", "c"])]

    def test_treats_variadic_positionals_built_via_argument_as_variadic(self):
        class In(BaseModel):
            files: Annotated[list[str], f.Argument()]

        seen: list[In] = []

        @f.command(name="greet")
        def greet(input: In) -> Ok:
            seen.append(input)
            return Ok()

        invoke(greet, "a", "b")
        assert seen == [In(files=["a", "b"])]

    def test_marks_options_without_a_default_as_mandatory(self):
        class In(BaseModel):
            name: str

        @f.command(name="greet")
        def greet(input: In) -> Ok:
            return Ok()

        result = invoke(greet)
        assert result.exit_code == 1
        assert result.stderr == "error: required option '--name <value>' not specified\n"

    def test_reports_validation_errors_from_input_like_commander(self):
        class In(BaseModel):
            count: Annotated[int, Field(ge=10)]

        called: list[bool] = []

        @f.command(name="greet")
        def greet(input: In) -> Ok:
            called.append(True)
            return Ok()

        result = invoke(greet, "--count", "3")
        assert result.exit_code == 1
        assert result.stderr == (
            "error: option '--count <value>' argument '3' is invalid. "
            "Input should be greater than or equal to 10\n"
        )
        assert called == []

    def test_option_attaches_a_short_flag(self):
        class In(BaseModel):
            verbose: Annotated[bool, f.Option(short="v")] = False

        seen: list[In] = []

        @f.command(name="greet")
        def greet(input: In) -> Ok:
            seen.append(input)
            return Ok()

        invoke(greet, "-v")
        assert seen == [In(verbose=True)]

    def test_option_attaches_an_env_binding(self):
        class In(BaseModel):
            port: Annotated[int, f.Option(envvar="FIREARGS_TEST_PORT")]

        seen: list[In] = []

        @f.command(name="greet")
        def greet(input: In) -> Ok:
            seen.append(input)
            return Ok()

        invoke(greet, env={"FIREARGS_TEST_PORT": "9090"})
        assert seen == [In(port=9090)]

    def test_option_attaches_conflicts(self):
        class In(BaseModel):
            rgb: Annotated[bool, f.Option(conflicts="cmyk")] = False
            cmyk: bool = False

        @f.command(name="greet")
        def greet(input: In) -> Ok:
            return Ok()

        result = invoke(greet, "--rgb", "--cmyk")
        assert result.exit_code == 1
        assert (
            result.stderr == "error: option '--rgb' cannot be used with option '--cmyk'\n"
        )

    def test_option_attaches_a_hidden_flag(self):
        class In(BaseModel):
            secret: Annotated[str, f.Option(hidden=True)]

        @f.command(name="greet")
        def greet(input: In) -> Ok:
            return Ok()

        assert "--secret" not in read_help(greet)

    def test_accepts_a_non_model_output(self):
        @f.command(name="list")
        def list_names(input: Empty) -> list[str]:
            return ["a", "b"]

        assert json.loads(invoke(list_names, "--json").stdout) == ["a", "b"]
        assert read_leaf_tool(list_names)["outputSchema"]["type"] == "array"

    def test_json_writes_null_for_a_none_output(self):
        @f.command(name="noop")
        def noop(input: Empty) -> None:
            return None

        assert invoke(noop, "--json").stdout == "null\n"

    def test_forwards_the_epilog_to_click_help(self):
        @f.command(name="greet", epilog="extra footer text")
        def greet(input: Empty) -> Empty:
            return input

        assert "extra footer text" in read_help(greet)

    def test_exposes_json_by_default(self):
        @f.command(name="greet")
        def greet(input: Empty) -> Empty:
            return input

        assert "--json" in read_help(greet)

    def test_json_value_drives_input_and_writes_output_json(self):
        class In(BaseModel):
            name: str

        @f.command(name="greet")
        def greet(input: In) -> Greeting:
            return Greeting(greeting=f"hello {input.name}")

        result = invoke(greet, "--json", '{"name":"world"}')
        assert json.loads(result.stdout) == {"greeting": "hello world"}

    def test_json_without_value_still_uses_cli_inputs_and_writes_json_output(self):
        class In(BaseModel):
            name: Annotated[str, f.Argument()]

        @f.command(name="greet")
        def greet(input: In) -> Greeting:
            return Greeting(greeting=f"hello {input.name}")

        result = invoke(greet, "world", "--json")
        assert json.loads(result.stdout) == {"greeting": "hello world"}

    def test_json_mode_rejects_input_invalid_for_the_model(self):
        class In(BaseModel):
            count: int

        @f.command(name="greet")
        def greet(input: In) -> Empty:
            return Empty()

        result = invoke(greet, "--json", '{"count":"not-a-number"}')
        assert result.exit_code == 1
        assert result.stderr == (
            "error: invalid --json input at 'count': Input should be a valid integer\n"
        )

    def test_json_mode_rejects_a_value_that_is_not_json(self):
        @f.command(name="greet")
        def greet(input: Empty) -> Empty:
            return input

        result = invoke(greet, "--json", "{not json")
        assert result.exit_code == 1
        assert result.stderr.startswith("error: --json value is not valid JSON: ")

    def test_still_raises_the_validation_error_when_the_output_is_invalid(self):
        @f.command(name="greet")
        def greet(input: Empty) -> NonNegative:
            return -1

        assert isinstance(invoke(greet).exception, ValidationError)

    def test_llms_prints_the_command_manifest_as_json(self):
        class In(BaseModel):
            name: str

        @f.command(name="greet", description="Greet someone")
        def greet(input: In) -> Greeting:
            return Greeting(greeting=f"hello {input.name}")

        tools = json.loads(invoke(greet, "--llms").stdout)["tools"]
        assert len(tools) == 2
        assert tools[0]["name"] == "help"
        assert "<binary> --json" in tools[0]["description"]
        assert tools[1]["name"] == "greet"
        assert tools[1]["description"] == "Greet someone"
        assert tools[1]["inputSchema"]["type"] == "object"
        assert "name" in tools[1]["inputSchema"]["properties"]
        assert tools[1]["outputSchema"]["type"] == "object"
        assert "greeting" in tools[1]["outputSchema"]["properties"]

    def test_llms_strips_cli_only_fireargs_metadata_from_the_manifest(self):
        class In(BaseModel):
            name: Annotated[str, f.Argument(description="user's name")]
            verbose: Annotated[bool, f.Option(short="v", envvar="VERBOSE")] = False
            times: int = 1
            kind: Literal["a", "b"]

        @f.command(name="greet")
        def greet(input: In) -> Empty:
            return Empty()

        props = read_leaf_tool(greet)["inputSchema"]["properties"]
        assert props["name"] == {
            "description": "user's name",
            "title": "Name",
            "type": "string",
        }
        assert props["verbose"] == {
            "default": False,
            "title": "Verbose",
            "type": "boolean",
        }
        assert props["times"] == {"default": 1, "title": "Times", "type": "integer"}
        assert props["kind"] == {"enum": ["a", "b"], "title": "Kind", "type": "string"}

    def test_llms_exposes_the_option_in_help(self):
        @f.command(name="greet")
        def greet(input: Empty) -> Empty:
            return input

        assert "--llms" in read_help(greet)

    def test_llms_option_false_suppresses_llms(self):
        @f.command(name="greet", llms_option=False)
        def greet(input: Empty) -> Empty:
            return input

        assert "--llms" not in read_help(greet)

    def test_json_option_false_suppresses_json(self):
        @f.command(name="greet", json_option=False)
        def greet(input: Empty) -> Empty:
            return input

        assert "--json" not in read_help(greet)

    def test_declares_required_positionals_as_angled_and_optional_ones_as_bracketed(self):
        class In(BaseModel):
            source: Annotated[str, f.Argument()]
            target: Annotated[str | None, f.Argument()] = None
            mode: Annotated[str, f.Argument()] = "fast"

        @f.command(name="copy")
        def copy(input: In) -> Empty:
            return Empty()

        assert read_usage(copy) == "[OPTIONS] <source> [target] [mode]"

    def test_declares_variadic_positionals_as_angled_unless_defaulted(self):
        class Required(BaseModel):
            files: Annotated[list[str], f.Argument()]

        class Defaulted(BaseModel):
            files: Annotated[list[str], f.Argument()] = []

        @f.command(name="lint")
        def required(input: Required) -> Empty:
            return Empty()

        @f.command(name="lint")
        def defaulted(input: Defaulted) -> Empty:
            return Empty()

        assert read_usage(required) == "[OPTIONS] <files...>"
        assert read_usage(defaulted) == "[OPTIONS] [files...]"

    def test_reports_a_missing_required_positional_like_commander(self):
        class In(BaseModel):
            name: Annotated[str, f.Argument()]

        called: list[bool] = []

        @f.command(name="greet")
        def greet(input: In) -> Empty:
            called.append(True)
            return Empty()

        result = invoke(greet)
        assert result.exit_code == 1
        assert result.stderr == "error: missing required argument 'name'\n"
        assert called == []

    def test_reports_a_missing_required_variadic_positional_like_commander(self):
        class In(BaseModel):
            files: Annotated[list[str], f.Argument()]

        @f.command(name="lint")
        def lint(input: In) -> Empty:
            return Empty()

        result = invoke(lint)
        assert result.exit_code == 1
        assert result.stderr == "error: missing required argument 'files'\n"

    def test_json_value_supplies_required_positionals(self):
        class In(BaseModel):
            name: Annotated[str, f.Argument()]

        @f.command(name="greet")
        def greet(input: In) -> Greeting:
            return Greeting(greeting=f"hello {input.name}")

        result = invoke(greet, "--json", '{"name":"world"}')
        assert json.loads(result.stdout) == {"greeting": "hello world"}

    def test_llms_needs_no_required_positionals(self):
        class In(BaseModel):
            name: Annotated[str, f.Argument()]

        @f.command(name="greet")
        def greet(input: In) -> Empty:
            return Empty()

        assert read_leaf_tool(greet)["name"] == "greet"

    def test_bare_json_still_requires_positionals_from_the_cli(self):
        class In(BaseModel):
            name: Annotated[str, f.Argument()]

        @f.command(name="greet")
        def greet(input: In) -> Empty:
            return Empty()

        result = invoke(greet, "--json")
        assert result.exit_code == 1
        assert result.stderr == "error: missing required argument 'name'\n"

    def test_requires_positionals_again_on_the_next_run_after_a_json_value(self):
        class In(BaseModel):
            name: Annotated[str, f.Argument()]

        @f.command(name="greet")
        def greet(input: In) -> Empty:
            return Empty()

        assert invoke(greet, "--json", '{"name":"world"}').exit_code == 0
        assert invoke(greet).exit_code == 1
        assert invoke(greet, "--json", '{"name":"world"}').exit_code == 0


class TestFlagNames:
    def test_derives_kebab_case_long_flags_from_snake_and_camel_case_keys(self):
        class In(BaseModel):
            header_rows: int
            HTMLParser: str | None = None
            maxDepth: int | None = None

        seen: list[In] = []

        @f.command(name="read")
        def read(input: In) -> Empty:
            seen.append(input)
            return Empty()

        help = read_help(read)
        assert "--header-rows <value>" in help
        assert "--html-parser <value>" in help
        assert "--max-depth <value>" in help
        invoke(read, "--header-rows", "2", "--max-depth", "3")
        assert seen[0].model_dump(exclude_unset=True) == {"header_rows": 2, "maxDepth": 3}

    def test_rejects_the_verbatim_key_as_a_flag(self):
        class In(BaseModel):
            header_rows: int

        @f.command(name="read")
        def read(input: In) -> Empty:
            return Empty()

        result = invoke(read, "--header_rows", "2")
        assert result.exit_code == 2
        assert "No such option" in result.stderr

    def test_option_name_overrides_the_long_flag(self):
        class In(BaseModel):
            to_path: Annotated[str, f.Option(name="to")]
            header_rows: Annotated[int, f.Option(name="headerRows")]

        seen: list[In] = []

        @f.command(name="read")
        def read(input: In) -> Empty:
            seen.append(input)
            return Empty()

        help = read_help(read)
        assert "--to <value>" in help
        assert "--to-path" not in help
        invoke(read, "--to", "out.csv", "--headerRows", "1")
        assert seen == [In(to_path="out.csv", header_rows=1)]

    def test_keeps_no_prefixed_keys_as_plain_flags_rather_than_negations(self):
        class In(BaseModel):
            no_cache: bool | None = None

        seen: list[In] = []

        @f.command(name="read")
        def read(input: In) -> Empty:
            seen.append(input)
            return Empty()

        invoke(read)
        invoke(read, "--no-cache")
        assert [item.model_dump(exclude_unset=True) for item in seen] == [
            {},
            {"no_cache": True},
        ]

    def test_resolves_conflicts_and_implies_by_input_key(self):
        class Conflicting(BaseModel):
            to_path: Annotated[str | None, f.Option(conflicts="to_stdout")] = None
            to_stdout: Annotated[bool | None, f.Option(name="stdout")] = None

        class Implying(BaseModel):
            dry_run: Annotated[bool | None, f.Option(implies={"skip_write": True})] = None
            skip_write: Annotated[bool | None, f.Option(name="no-write")] = None

        seen: list[Implying] = []

        @f.command(name="read")
        def conflicting(input: Conflicting) -> Empty:
            return Empty()

        @f.command(name="read")
        def implying(input: Implying) -> Empty:
            seen.append(input)
            return Empty()

        result = invoke(conflicting, "--to-path", "x", "--stdout")
        assert result.exit_code == 1
        assert "cannot be used with" in result.stderr
        invoke(implying, "--dry-run")
        assert seen == [Implying(dry_run=True, skip_write=True)]

    def test_combines_short_env_and_kebab_flags(self):
        class In(BaseModel):
            header_rows: Annotated[
                int, f.Option(short="r", envvar="FIREARGS_TEST_HEADER_ROWS")
            ]

        seen: list[In] = []

        @f.command(name="read")
        def read(input: In) -> Empty:
            seen.append(input)
            return Empty()

        assert "-r, --header-rows <value>" in read_help(read)
        invoke(read, env={"FIREARGS_TEST_HEADER_ROWS": "3"})
        assert seen == [In(header_rows=3)]

    def test_names_positionals_in_kebab_case_and_honours_argument_name(self):
        class In(BaseModel):
            source_path: Annotated[str, f.Argument()]
            target_path: Annotated[str, f.Argument(name="target")]

        seen: list[In] = []

        @f.command(name="read")
        def read(input: In) -> Empty:
            seen.append(input)
            return Empty()

        assert read_usage(read) == "[OPTIONS] <source-path> <target>"
        invoke(read, "a.csv", "b.csv")
        assert seen == [In(source_path="a.csv", target_path="b.csv")]

    def test_names_a_missing_kebab_case_positional_and_option_by_their_cli_names(self):
        class In(BaseModel):
            source_path: Annotated[str, f.Argument()]
            header_rows: Annotated[int, f.Option(ge=1)]

        @f.command(name="read")
        def read(input: In) -> Empty:
            return Empty()

        assert invoke(read).stderr == "error: missing required argument 'source-path'\n"
        assert invoke(read, "a.csv", "--header-rows", "0").stderr == (
            "error: option '--header-rows <value>' argument '0' is invalid. "
            "Input should be greater than or equal to 1\n"
        )

    def test_json_without_a_value_reads_kebab_flags(self):
        class In(BaseModel):
            header_rows: int

        @f.command(name="read")
        def read(input: In) -> In:
            return input

        result = invoke(read, "--header-rows", "2", "--json")
        assert json.loads(result.stdout) == {"header_rows": 2}

    def test_llms_keeps_input_keys_and_strips_name(self):
        class In(BaseModel):
            source_path: Annotated[str, f.Argument(name="source")]
            to_path: Annotated[str, f.Option(name="to")]

        @f.command(name="read")
        def read(input: In) -> Empty:
            return Empty()

        written = invoke(read, "--llms").stdout
        tool = json.loads(written)["tools"][1]
        assert list(tool["inputSchema"]["properties"]) == ["source_path", "to_path"]
        assert '"name": "to"' not in written
        assert "fireargs" not in written

    def test_throws_when_two_fields_derive_the_same_flag(self):
        class In(BaseModel):
            to_path: str
            toPath: str

        def read(input: In) -> Empty:
            return Empty()

        with pytest.raises(ValueError, match="conflicting flag"):
            f.command(name="read")(read)


class TestOptionSemantics:
    def test_gives_a_bool_defaulting_to_true_a_no_flag(self):
        class In(BaseModel):
            color: bool = True
            quiet: bool = False
            no_cache: bool = True

        seen: list[In] = []

        @f.command(name="read")
        def read(input: In) -> Empty:
            seen.append(input)
            return Empty()

        help = read_help(read)
        assert "--color / --no-color" in help
        assert "--no-quiet" not in help
        assert "--no-no-cache" not in help
        invoke(read, "--no-color")
        invoke(read, "--no-color", "--color")
        assert [item.color for item in seen] == [False, True]

    def test_throws_when_a_no_flag_clashes_with_a_sibling_field(self):
        class In(BaseModel):
            color: bool = True
            no_color: bool | None = None

        def read(input: In) -> Empty:
            return Empty()

        with pytest.raises(ValueError, match="conflicting flag '--no-color'"):
            f.command(name="read")(read)

    def test_shows_bool_defaults_lowercase_as_commander_does(self):
        class In(BaseModel):
            color: bool = True
            quiet: bool = False

        @f.command(name="read")
        def read(input: In) -> Empty:
            return Empty()

        help = read_help(read)
        assert "[default: true]" in help
        assert "[default: false]" in help

    def test_labels_a_count_and_an_is_flag_option_without_a_value(self):
        class In(BaseModel):
            verbose: Annotated[int, f.Option(count=True, conflicts="quiet")] = 0
            quiet: Annotated[int, f.Option(is_flag=True, flag_value=1)] = 0

        @f.command(name="read")
        def read(input: In) -> Empty:
            return Empty()

        result = invoke(read, "--verbose", "--quiet")
        assert result.exit_code == 1
        assert result.stderr == (
            "error: option '--verbose' cannot be used with option '--quiet'\n"
        )

    def test_quotes_the_token_typed_not_the_value_parse_made(self):
        class In(BaseModel):
            pair: Annotated[
                tuple[int, int], f.Option(parse=lambda text: tuple(text.split(":")))
            ]

        @f.command(name="read")
        def read(input: In) -> Empty:
            return Empty()

        result = invoke(read, "--pair", "1:x")
        assert result.exit_code == 1
        assert result.stderr.startswith("error: option '--pair <value>' argument '1:x'")

    def test_names_the_env_var_of_an_env_value_the_model_rejects(self):
        class In(BaseModel):
            times: Annotated[int, f.Option(envvar="FIREARGS_TEST_TIMES", ge=1)] = 1

        @f.command(name="read")
        def read(input: In) -> Empty:
            return Empty()

        result = invoke(read, env={"FIREARGS_TEST_TIMES": "0"})
        assert result.exit_code == 1
        assert result.stderr.startswith(
            "error: option '--times <value>' value '0' from env 'FIREARGS_TEST_TIMES'"
            " is invalid. "
        )


class TestCliValueParsing:
    def test_applies_option_parse_to_the_argv_string(self):
        class In(BaseModel):
            missing: Annotated[list[str], f.Option(parse=lambda v: v.split(","))]

        seen: list[In] = []

        @f.command(name="greet")
        def greet(input: In) -> Empty:
            seen.append(input)
            return Empty()

        invoke(greet, "--missing", "a,b")
        assert seen == [In(missing=["a", "b"])]
        help = read_help(greet)
        assert "--missing <value>" in help
        assert "<value...>" not in help

    def test_leaves_json_input_to_pydantic_without_calling_parse(self):
        class In(BaseModel):
            missing: Annotated[list[str], f.Option(parse=lambda v: v.split(","))]

        seen: list[In] = []

        @f.command(name="greet")
        def greet(input: In) -> Empty:
            seen.append(input)
            return Empty()

        invoke(greet, "--json", '{"missing":["a,b"]}')
        assert seen == [In(missing=["a,b"])]

    def test_parses_a_value_union_such_as_false_or_list_of_int(self):
        def parse_rows(value: str) -> Literal[False] | list[int]:
            return False if value == "false" else [int(v) for v in value.split(",")]

        class In(BaseModel):
            header_rows: Annotated[
                Literal[False] | list[int] | None, f.Option(parse=parse_rows)
            ] = None

        seen: list[In] = []

        @f.command(name="greet")
        def greet(input: In) -> Empty:
            seen.append(input)
            return Empty()

        invoke(greet, "--header-rows", "false")
        invoke(greet, "--header-rows", "1,2")
        assert seen == [In(header_rows=False), In(header_rows=[1, 2])]

    def test_takes_a_value_even_when_a_parsed_field_is_boolean(self):
        class In(BaseModel):
            on: Annotated[bool | None, f.Option(parse=lambda v: v == "yes")] = None

        seen: list[In] = []

        @f.command(name="greet")
        def greet(input: In) -> Empty:
            seen.append(input)
            return Empty()

        invoke(greet, "--on", "yes")
        assert seen == [In(on=True)]

    def test_applies_parse_to_env_values(self):
        class In(BaseModel):
            tags: Annotated[
                list[str] | None,
                f.Option(envvar="FIREARGS_TEST_TAGS", parse=lambda v: v.split(",")),
            ] = None

        seen: list[In] = []

        @f.command(name="greet")
        def greet(input: In) -> Empty:
            seen.append(input)
            return Empty()

        invoke(greet, env={"FIREARGS_TEST_TAGS": "a,b"})
        assert seen == [In(tags=["a", "b"])]

    def test_applies_argument_parse_to_the_positional_string(self):
        def parse_pairs(value: str) -> dict[str, str]:
            return dict(pair.split(":", 1) for pair in value.split(","))

        class In(BaseModel):
            pairs: Annotated[dict[str, str], f.Argument(parse=parse_pairs)]

        seen: list[In] = []

        @f.command(name="greet")
        def greet(input: In) -> Empty:
            seen.append(input)
            return Empty()

        invoke(greet, "a:int,b:str")
        assert seen == [In(pairs={"a": "int", "b": "str"})]
        assert read_usage(greet) == "[OPTIONS] <pairs>"

    def test_reports_a_raising_parse_as_an_invalid_option_argument(self):
        class In(BaseModel):
            props: Annotated[dict[str, object] | None, f.Option(parse=json.loads)] = None

        @f.command(name="greet")
        def greet(input: In) -> Empty:
            return Empty()

        result = invoke(greet, "--props", "{")
        assert result.exit_code == 1
        assert result.stderr.startswith(
            "error: option '--props <value>' argument '{' is invalid. "
        )

    def test_keeps_parse_in_the_field_meta(self):
        def parse(value: str) -> list[str]:
            return value.split(",")

        assert read_field_meta(f.Option(parse=parse)) == OptionMeta(parse=parse)

    def test_coerces_cli_strings_for_number_fields(self):
        class In(BaseModel):
            rows: int | None = None
            ratio: Annotated[float, f.Option(short="r")]
            page: Annotated[int | None, f.Argument()] = None

        seen: list[In] = []

        @f.command(name="greet")
        def greet(input: In) -> Empty:
            seen.append(input)
            return Empty()

        invoke(greet, "2", "--rows", "10", "-r", "0.5")
        assert seen == [In(rows=10, ratio=0.5, page=2)]

    def test_rejects_a_cli_string_that_is_not_a_number(self):
        class In(BaseModel):
            rows: float | None = None

        @f.command(name="greet")
        def greet(input: In) -> Empty:
            return Empty()

        for value in ["abc", ""]:
            result = invoke(greet, "--rows", value)
            assert result.exit_code == 1
            assert result.stderr == (
                f"error: option '--rows <value>' argument '{value}' is invalid. Not a number.\n"
            )

    def test_coerces_each_value_of_a_variadic_number_field(self):
        class In(BaseModel):
            ids: Annotated[list[int] | None, f.Argument()] = None
            rows: list[int] = [1]

        seen: list[In] = []

        @f.command(name="greet")
        def greet(input: In) -> Empty:
            seen.append(input)
            return Empty()

        invoke(greet)
        invoke(greet, "7", "8", "--rows", "2", "--rows", "3", "--rows", "4")
        assert seen == [In(ids=None, rows=[1]), In(ids=[7, 8], rows=[2, 3, 4])]

    def test_keeps_json_number_fields_strict(self):
        class In(BaseModel):
            rows: int

        @f.command(name="greet")
        def greet(input: In) -> In:
            return input

        assert invoke(greet, "--json", '{"rows":"3"}').exit_code == 1
        assert json.loads(invoke(greet, "--json", '{"rows":3}').stdout) == {"rows": 3}
        assert json.loads(invoke(greet, "--rows", "3", "--json").stdout) == {"rows": 3}

    def test_describes_a_parsed_field_by_its_type_without_meta(self):
        class In(BaseModel):
            missing: Annotated[list[str], f.Option(parse=lambda v: v.split(","))]

        @f.command(name="greet")
        def greet(input: In) -> Empty:
            return Empty()

        assert read_leaf_tool(greet)["inputSchema"]["properties"]["missing"] == {
            "items": {"type": "string"},
            "title": "Missing",
            "type": "array",
        }

    def test_leaves_defaulted_input_fields_out_of_required(self):
        class In(BaseModel):
            name: str
            times: int = 1

        class Out(BaseModel):
            count: int = 0

        @f.command(name="greet")
        def greet(input: In) -> Out:
            return Out()

        tool = read_leaf_tool(greet)
        assert tool["inputSchema"]["required"] == ["name"]
        assert tool["outputSchema"]["required"] == ["count"]


class TestJsonOutput:
    def test_omits_the_none_of_optional_fields_but_keeps_explicit_nulls(self):
        class Out(BaseModel):
            note: str | None = None
            owner: str | None
            count: int | None = None

        @f.command(name="show")
        def show(input: Empty) -> Out:
            return Out(owner=None, count=3)

        assert json.loads(invoke(show, "--json").stdout) == {"owner": None, "count": 3}

    def test_omits_optionals_inside_nested_models_lists_and_dicts(self):
        class Item(BaseModel):
            name: str
            tag: str | None = None

        class Out(BaseModel):
            items: list[Item]
            by_name: dict[str, Item]

        @f.command(name="show")
        def show(input: Empty) -> Out:
            item = Item(name="a")
            return Out(items=[item, Item(name="b", tag="t")], by_name={"a": item})

        assert json.loads(invoke(show, "--json").stdout) == {
            "items": [{"name": "a"}, {"name": "b", "tag": "t"}],
            "by_name": {"a": {"name": "a"}},
        }

    def test_writes_output_fields_by_their_alias(self):
        class Out(BaseModel):
            header_rows: int = Field(alias="headerRows")
            sheet: str | None = Field(default=None, alias="sheetName")

        @f.command(name="show")
        def show(input: Empty) -> Out:
            return Out.model_validate({"headerRows": 2})

        assert json.loads(invoke(show, "--json").stdout) == {"headerRows": 2}

    def test_writes_output_fields_by_their_serialization_alias(self):
        class Out(BaseModel):
            header_rows: int = Field(serialization_alias="headerRows")

        @f.command(name="show")
        def show(input: Empty) -> Out:
            return Out(header_rows=2)

        assert json.loads(invoke(show, "--json").stdout) == {"headerRows": 2}

    def test_keeps_computed_and_extra_fields(self):
        class Out(BaseModel):
            model_config = ConfigDict(extra="allow")

            width: int

            @computed_field
            @property
            def double(self) -> int:
                return self.width * 2

        @f.command(name="show")
        def show(input: Empty) -> Out:
            return Out.model_validate({"width": 2, "unit": "px"})

        assert json.loads(invoke(show, "--json").stdout) == {
            "width": 2,
            "unit": "px",
            "double": 4,
        }

    def test_masks_a_hide_input_value_but_keeps_the_reason_in_input_errors(self):
        class In(BaseModel):
            pin: Annotated[int, f.Option(hide_input=True, ge=1000)]

        @f.command(name="login")
        def login(input: In) -> Empty:
            return Empty()

        reasons = {
            "12": "Input should be greater than or equal to 1000",
            "secret": "Not a number.",
        }
        for value, reason in reasons.items():
            result = invoke(login, "--pin", value)
            assert result.exit_code == 1
            assert result.stderr == (
                f"error: option '--pin <value>' argument '***' is invalid. {reason}\n"
            )


class TestHandlerContext:
    def run_with_context(self, *args: str):
        class In(BaseModel):
            name: str = "world"

        seen: list[f.Context] = []

        @f.command(name="greet")
        def greet(input: In, context: f.Context) -> Empty:
            seen.append(context)
            return Empty()

        invoke(greet, *args)
        return greet, seen[0]

    def test_reports_human_mode_without_json(self):
        command, context = self.run_with_context()
        assert context.json is False
        assert context.command is command

    def test_reports_json_mode_for_a_bare_json(self):
        _, context = self.run_with_context("--json")
        assert context.json is True

    def test_reports_json_mode_for_json_with_a_value(self):
        _, context = self.run_with_context("--json", '{"name":"x"}')
        assert context.json is True


class Text(BaseModel):
    text: Annotated[str, f.Argument()]


class Size(TypedDict):
    size: Annotated[int, AfterValidator(lambda n: n * 10)]


class TestRender:
    def build_rendered(self, render: Callable[[Size], str | None]):
        @f.command(name="measure")
        def measure(input: Text) -> Size:
            return {"size": len(input.text)}

        @measure.render
        def show(output: Size, context: f.RenderContext[Text]) -> str | None:
            return render(output)

        return measure

    def test_writes_a_returned_string_to_stdout_in_human_mode(self):
        command = self.build_rendered(lambda output: f"size {output['size']}")
        assert invoke(command, "abc").stdout == "size 30\n"

    def test_receives_the_parsed_input_and_a_human_mode_context(self):
        seen: list[f.RenderContext[Text]] = []

        @f.command(name="echo")
        def echo(input: Text) -> Empty:
            return Empty()

        @echo.render
        def show(output: Empty, context: f.RenderContext[Text]) -> None:
            seen.append(context)

        invoke(echo, "hi")
        assert seen[0].input == Text(text="hi")
        assert seen[0].json is False
        assert seen[0].command is echo

    def test_is_skipped_in_json_mode(self):
        calls: list[Size] = []

        def render(output: Size) -> str:
            calls.append(output)
            return "human"

        result = invoke(self.build_rendered(render), "abc", "--json")
        assert calls == []
        assert json.loads(result.stdout) == {"size": 30}

    def test_prints_nothing_in_human_mode_without_render(self):
        @f.command(name="greet")
        def greet(input: Empty) -> Ok:
            return Ok()

        assert invoke(greet).stdout == ""


def render_error_default(error: Exception, context: f.Context) -> object:
    return {"error": str(error)} if context.json else f"error: {error}"


class Count(BaseModel):
    count: int


class TestRenderError:
    def build_failing(
        self,
        handler: Callable[[], int] = lambda: 1,
        render: Callable[[], None] = lambda: None,
        render_error: Callable[[Exception, f.Context], object] = render_error_default,
    ):
        @f.command(name="fail", render_error=render_error)
        def fail(input: Count) -> NonNegative:
            return handler()

        @fail.render
        def show(output: int, context: f.RenderContext[Count]) -> None:
            render()

        return fail

    def test_writes_the_hook_value_as_json_for_invalid_json_input(self):
        result = invoke(self.build_failing(), "--json", "{not json")
        assert "error" in json.loads(result.stdout)
        assert result.exit_code == 1

    def test_writes_the_hook_value_as_json_for_an_input_validation_failure(self):
        result = invoke(self.build_failing(), "--json", '{"count":"x"}')
        assert "error" in json.loads(result.stdout)
        assert result.exit_code == 1

    def test_writes_the_hook_value_as_json_for_a_handler_exception(self):
        def handler() -> int:
            raise RuntimeError("boom")

        result = invoke(self.build_failing(handler=handler), "--json", '{"count":1}')
        assert json.loads(result.stdout) == {"error": "boom"}
        assert result.exit_code == 1

    def test_writes_the_hook_value_as_json_for_an_output_validation_failure(self):
        result = invoke(self.build_failing(handler=lambda: -1), "--json", '{"count":1}')
        assert "error" in json.loads(result.stdout)
        assert result.exit_code == 1

    def test_writes_the_hook_string_to_stderr_for_a_render_failure(self):
        def render() -> None:
            raise RuntimeError("render broke")

        result = invoke(self.build_failing(render=render), "--count", "1")
        assert result.stdout == ""
        assert result.stderr == "error: render broke\n"
        assert result.exit_code == 1

    def test_propagates_an_error_the_hook_reraises(self):
        def handler() -> int:
            raise RuntimeError("boom")

        def render_error(error: Exception, context: f.Context) -> object:
            raise error

        command = self.build_failing(handler=handler, render_error=render_error)
        result = invoke(command, "--count", "1")
        assert isinstance(result.exception, RuntimeError)
        assert str(result.exception) == "boom"

    def test_registers_the_hook_with_a_decorator(self):
        @f.command(name="fail")
        def fail(input: Empty) -> Empty:
            raise RuntimeError("boom")

        @fail.render_error
        def show(error: Exception, context: f.Context) -> object:
            return f"failed: {error}"

        result = invoke(fail)
        assert result.stderr == "failed: boom\n"
        assert result.exit_code == 1


class TestVersionOption:
    def test_prints_the_version_through_custom_flags(self):
        @f.command(
            name="tool",
            version="1.2.3",
            version_option={"flags": "-v, --version", "description": "show the version"},
        )
        def tool(input: Empty) -> Empty:
            return input

        help = read_help(tool)
        assert "-v, --version" in help
        assert "show the version" in help
        result = invoke(tool, "-v")
        assert result.exit_code == 0
        assert result.stdout == "1.2.3\n"


class TestHandlerShapes:
    def test_derives_the_command_name_from_the_handler(self):
        @f.command()
        def show_status(input: Empty) -> Empty:
            return input

        assert show_status.name == "show-status"

    def test_runs_a_handler_without_a_context_parameter(self):
        @f.command(name="greet")
        def greet(input: Empty) -> Ok:
            return Ok()

        assert greet.takes_context is False
        assert json.loads(invoke(greet, "--json").stdout) == {"ok": True}

    def test_awaits_an_async_handler_and_render(self):
        class In(BaseModel):
            name: str

        @f.command(name="greet")
        async def greet(input: In) -> Greeting:
            return Greeting(greeting=f"hello {input.name}")

        @greet.render
        async def show(output: Greeting, context: f.RenderContext[In]) -> str:
            return output.greeting

        assert json.loads(invoke(greet, "--name", "x", "--json").stdout) == {
            "greeting": "hello x"
        }
        assert invoke(greet, "--name", "x").stdout == "hello x\n"

    def test_render_decorator_returns_the_render(self):
        @f.command(name="greet")
        def greet(input: Empty) -> Ok:
            return Ok()

        def show(output: Ok, context: f.RenderContext[Empty]) -> str:
            return "ok"

        assert greet.render(show) is show
        assert greet.renderer is show

    def test_rejects_unknown_handler_shapes(self):
        def no_annotation(input) -> Empty:
            return Empty()

        def non_model_input(input: str) -> Empty:
            return Empty()

        def no_return(input: Empty):
            return input

        def no_parameters() -> Empty:
            return Empty()

        def three_parameters(input: Empty, context: f.Context, extra: int) -> Empty:
            return input

        shapes: list[Callable[..., object]] = [
            no_annotation,
            non_model_input,
            no_return,
            no_parameters,
            three_parameters,
        ]
        for shape in shapes:
            with pytest.raises(TypeError):
                f.command()(shape)


class Paging(BaseModel):
    limit: Annotated[int, f.Option(short="l", ge=1)] = 20


class Verbosity(BaseModel):
    verbose: Annotated[bool, f.Option(short="v")] = False


Limit = Annotated[int, f.Option(short="l", ge=1, description="Rows to read")]


class TestInputModels:
    def test_mixins_carry_option_meta_through_inheritance(self):
        class In(Paging, Verbosity):
            query: Annotated[str, f.Argument()]

        seen: list[In] = []

        @f.command(name="search")
        def search(input: In) -> Empty:
            seen.append(input)
            return Empty()

        invoke(search, "cats", "-l", "5", "-v")
        assert seen == [In(query="cats", limit=5, verbose=True)]
        assert invoke(search, "cats", "-l", "0").exit_code == 1

    def test_orders_fields_of_a_multiple_inheritance_model_by_pydantic_mro(self):
        class In(Paging, Verbosity):
            query: str

        @f.command(name="search")
        def search(input: In) -> Empty:
            return Empty()

        assert [spec.key for spec in search.fields] == ["verbose", "limit", "query"]

    def test_overrides_an_annotated_option_default_at_the_use_site(self):
        class In(BaseModel):
            limit: Limit = 500

        seen: list[In] = []

        @f.command(name="read")
        def read(input: In) -> Empty:
            seen.append(input)
            return Empty()

        invoke(read)
        invoke(read, "-l", "3")
        assert seen == [In(limit=500), In(limit=3)]
        assert "[default: 500]" in read_help(read)
        assert "Rows to read" in read_help(read)

    def test_option_routes_pydantic_settings_to_the_field_and_click_ones_to_the_meta(
        self,
    ):
        info = f.Option(ge=1, description="Rows", default=5, envvar="ROWS", hidden=True)
        meta = read_field_meta(info)

        assert info.default == 5
        assert info.description == "Rows"
        assert any(getattr(item, "ge", None) == 1 for item in info.metadata)
        assert info.json_schema_extra is None
        assert isinstance(meta, OptionMeta)
        assert meta.envvar == "ROWS"
        assert meta.hidden is True


class TestParityDetails:
    def test_reports_a_cli_value_error_even_with_a_render_error_hook(self):
        class In(BaseModel):
            port: int

        seen: list[Exception] = []

        @f.command(name="serve", render_error=lambda error, context: seen.append(error))
        def serve(input: In) -> Empty:
            return Empty()

        result = invoke(serve, "--port", "abc")
        assert (
            result.stderr
            == "error: option '--port <value>' argument 'abc' is invalid. Not a number.\n"
        )
        assert result.exit_code == 1
        assert seen == []

    def test_shows_an_argument_default_in_help(self):
        class In(BaseModel):
            path: Annotated[str, f.Argument(description="Path")] = "a.csv"
            dir: Annotated[str, f.Argument(default_description="cwd")] = "."

        @f.command(name="read")
        def read(input: In) -> Empty:
            return Empty()

        help = read_help(read)
        assert "Path  [default: a.csv]" in help
        assert "[default: cwd]" in help

    def test_shows_a_list_option_as_one_value_repeated(self):
        class In(BaseModel):
            tags: list[str] = []

        @f.command(name="tag")
        def tag(input: In) -> In:
            return input

        assert "--tags <value>" in read_help(tag)
        assert json.loads(invoke(tag, "--tags", "a", "--tags", "b", "--json").stdout) == {
            "tags": ["a", "b"]
        }


class TestOptionalHookContext:
    def test_calls_a_render_that_takes_only_the_output(self):
        class In(BaseModel):
            name: str

        class Out(BaseModel):
            greeting: str

        @f.command(name="greet")
        def greet(input: In) -> Out:
            return Out(greeting=f"hello {input.name}")

        @greet.render
        def render(output: Out) -> str:
            return output.greeting

        assert invoke(greet, "--name", "ada").stdout == "hello ada\n"

    def test_calls_a_render_error_that_takes_only_the_error(self):
        @f.command(name="boom", render_error=lambda error: f"failed: {error}")
        def boom(input: Empty) -> Empty:
            raise RuntimeError("boom")

        result = invoke(boom)
        assert result.stderr == "failed: boom\n"
        assert result.exit_code == 1

    def test_still_passes_the_context_to_a_two_argument_hook(self):
        seen: list[bool] = []

        @f.command(name="show")
        def show(input: Empty) -> Empty:
            return Empty()

        @show.render
        def render(output: Empty, context: f.RenderContext[Empty]) -> str:
            seen.append(context.json)
            return "ok"

        assert invoke(show).stdout == "ok\n"
        assert seen == [False]
