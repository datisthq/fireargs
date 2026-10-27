import json
import re
from collections.abc import Callable
from typing import Annotated, Literal

import click
from click.testing import CliRunner, Result
from pydantic import BaseModel

import fireargs as f

runner = CliRunner()

type RenderError = Callable[[Exception, f.Context], object]


def invoke(command: click.Command, *args: str) -> Result:
    return runner.invoke(command, list(args))


class Empty(BaseModel):
    pass


class Name(BaseModel):
    name: str


class Greeting(BaseModel):
    greeting: str


def build_greet(description: str = ""):
    @f.command(name="greet", description=description)
    def greet(input: Name) -> Greeting:
        return Greeting(greeting=f"hello {input.name}")

    return greet


def build_empty(name: str):
    @f.command(name=name)
    def empty(input: Empty) -> Empty:
        return input

    return empty


class TestProgram:
    def test_returns_a_program_with_its_routes_attached(self):
        cli = f.Program(
            name="myapp",
            description="My CLI",
            router={"greet": build_empty("greet"), "deploy": build_empty("deploy")},
        )

        assert isinstance(cli, f.Program)
        assert isinstance(cli, click.Group)
        assert cli.name == "myapp"
        assert cli.help == "My CLI"
        assert list(cli.commands) == ["greet", "deploy"]

    def test_object_key_overrides_leaf_name(self):
        cli = f.Program(name="myapp", router={"greet": build_empty("x")})

        assert list(cli.commands) == ["greet"]
        assert invoke(cli, "greet").exit_code == 0
        assert invoke(cli, "x").exit_code == 1

    def test_dispatches_subcommand_json_invocation(self):
        cli = f.Program(name="myapp", router={"greet": build_greet()})

        result = invoke(cli, "greet", "--json", '{"name":"world"}')
        assert json.loads(result.stdout) == {"greeting": "hello world"}

    def test_requires_a_leaf_positionals_again_after_a_json_dispatch(self):
        class In(BaseModel):
            name: Annotated[str, f.Argument()]

        @f.command(name="greet")
        def greet(input: In) -> Greeting:
            return Greeting(greeting=f"hello {input.name}")

        cli = f.Program(name="myapp", router={"greet": greet})

        result = invoke(cli, "greet", "--json", '{"name":"world"}')
        assert json.loads(result.stdout) == {"greeting": "hello world"}
        result = invoke(cli, "greet")
        assert result.exit_code == 1
        assert result.stderr == "error: missing required argument 'name'\n"

    def test_dispatches_kebab_case_flags_to_a_nested_leaf(self):
        class In(BaseModel):
            header_rows: int

        seen: list[In] = []

        @f.command(name="read")
        def read(input: In) -> Empty:
            seen.append(input)
            return Empty()

        cli = f.Program(name="myapp", router={"table": f.Program(router={"read": read})})

        invoke(cli, "table", "read", "--header-rows", "2")
        assert seen == [In(header_rows=2)]

    def test_llms_emits_a_manifest_with_all_subcommand_schemas(self):
        class Env(BaseModel):
            env: Literal["staging", "prod"]

        class Ok(BaseModel):
            ok: bool

        @f.command(name="deploy", description="Deploys")
        def deploy(input: Env) -> Ok:
            return Ok(ok=True)

        cli = f.Program(
            name="myapp",
            description="My CLI",
            version="1.0.0",
            router={
                "greet": build_greet(description="Greets the user"),
                "deploy": deploy,
            },
        )

        tools = json.loads(invoke(cli, "--llms").stdout)["tools"]
        assert len(tools) == 3
        assert tools[0]["name"] == "help"
        assert "--json" in tools[0]["description"]
        greet_tool = next(tool for tool in tools if tool["name"] == "greet")
        deploy_tool = next(tool for tool in tools if tool["name"] == "deploy")
        assert greet_tool["description"] == "Greets the user"
        assert "name" in greet_tool["inputSchema"]["properties"]
        assert "greeting" in greet_tool["outputSchema"]["properties"]
        assert deploy_tool["inputSchema"]["properties"]["env"]["enum"] == [
            "staging",
            "prod",
        ]

    def test_llms_keeps_the_whole_tree_when_one_leaf_parses_input(self):
        class In(BaseModel):
            missing: Annotated[list[str], f.Option(parse=lambda v: v.split(","))]

        @f.command(name="table")
        def table(input: In) -> Empty:
            return Empty()

        cli = f.Program(
            name="myapp",
            router={"data": f.Program(name="data", router={"table": table})},
        )

        tool = json.loads(invoke(cli, "--llms").stdout)["tools"][1]
        assert tool["name"] == "data table"
        assert tool["inputSchema"]["properties"]["missing"]["type"] == "array"

    def test_subcommand_llms_still_works_after_attachment(self):
        cli = f.Program(name="myapp", router={"greet": build_greet(description="Greets")})

        tools = json.loads(invoke(cli, "greet", "--llms").stdout)["tools"]
        assert len(tools) == 2
        assert tools[0]["name"] == "help"
        assert tools[1]["name"] == "greet"
        assert "name" in tools[1]["inputSchema"]["properties"]
        assert "greeting" in tools[1]["outputSchema"]["properties"]

    def test_composes_recursively_so_nested_programs_appear_in_the_llms_manifest(self):
        api = f.Program(
            name="api",
            description="API subtree",
            router={"greet": build_greet(description="Greets")},
        )
        cli = f.Program(name="myapp", router={"api": api})

        tools = json.loads(invoke(cli, "--llms").stdout)["tools"]
        assert len(tools) == 2
        assert tools[0]["name"] == "help"
        assert tools[1]["name"] == "api greet"
        assert tools[1]["description"] == "Greets"
        assert "name" in tools[1]["inputSchema"]["properties"]

    def test_dispatches_through_nested_programs(self):
        api = f.Program(name="api", router={"greet": build_greet()})
        cli = f.Program(name="myapp", router={"api": api})

        result = invoke(cli, "api", "greet", "--json", '{"name":"world"}')
        assert json.loads(result.stdout) == {"greeting": "hello world"}

    def test_llms_option_false_suppresses_llms_on_the_program_only(self):
        cli = f.Program(
            name="myapp", llms_option=False, router={"greet": build_empty("greet")}
        )

        assert "--llms" not in invoke(cli, "--help").stdout
        assert "--llms" in invoke(cli, "greet", "--help").stdout

    def test_lists_a_command_under_its_help_group_heading_in_the_parent_help(self):
        @f.command(description="Deploys", help_group="Ops")
        def deploy(input: Empty) -> Empty:
            return input

        @f.command(description="Shows status")
        def status(input: Empty) -> Empty:
            return input

        cli = f.Program(name="myapp", router={"deploy": deploy, "status": status})

        help = invoke(cli, "--help").stdout
        assert re.search(r"Ops:\n {2}deploy.*Deploys", help)
        assert re.search(r"Commands:\n {2}status.*Shows status", help)

    def test_lists_a_nested_program_under_its_help_group_heading_in_the_parent_help(self):
        users = f.Program(
            description="Manages users",
            help_group="Admin",
            router={"list": build_empty("list")},
        )
        cli = f.Program(name="myapp", router={"users": users})

        assert re.search(
            r"Admin:\n {2}users.*Manages users", invoke(cli, "--help").stdout
        )

    def test_resolves_a_route_by_its_alias(self):
        @f.command(name="deploy", aliases=["ship"])
        def deploy(input: Empty) -> Empty:
            return input

        cli = f.Program(name="myapp", router={"deploy": deploy})

        assert invoke(cli, "ship").exit_code == 0

    def test_prints_its_help_without_a_subcommand(self):
        cli = f.Program(name="myapp", router={"greet": build_empty("greet")})

        result = invoke(cli)
        assert result.exit_code == 0
        assert "Commands:" in result.stdout

    def test_fails_on_an_unknown_command(self):
        cli = f.Program(name="myapp", router={"greet": build_empty("greet")})

        result = invoke(cli, "nope")
        assert result.exit_code == 1
        assert result.stderr == "error: unknown command 'nope'\n"

    def test_prints_a_command_help_through_help(self):
        cli = f.Program(name="myapp", router={"greet": build_greet("Greets the user")})

        result = invoke(cli, "help", "greet")
        assert result.exit_code == 0
        assert result.stdout.startswith("Usage: myapp greet")
        assert "Greets the user" in result.stdout

    def test_prints_its_own_help_through_help(self):
        cli = f.Program(name="myapp", router={"greet": build_empty("greet")})

        result = invoke(cli, "help")
        assert result.exit_code == 0
        assert result.stdout == invoke(cli).stdout
        assert re.search(r"^  help +display help for command$", result.stdout, re.M)

    def test_fails_on_help_for_an_unknown_command(self):
        cli = f.Program(name="myapp", router={"greet": build_empty("greet")})

        result = invoke(cli, "help", "nope")
        assert result.exit_code == 1
        assert result.stderr == "error: unknown command 'nope'\n"

    def test_keeps_a_route_named_help_over_the_help_command(self):
        cli = f.Program(name="myapp", router={"help": build_greet()})

        result = invoke(cli, "help", "--json", '{"name":"world"}')
        assert json.loads(result.stdout) == {"greeting": "hello world"}
        assert len(re.findall(r"^  help", invoke(cli).stdout, re.M)) == 1

    def test_leaves_the_help_command_out_of_llms(self):
        cli = f.Program(name="myapp", router={"greet": build_empty("greet")})

        tools = json.loads(invoke(cli, "--llms").stdout)["tools"]
        assert [tool["name"] for tool in tools] == ["help", "greet"]

    def test_mounts_one_leaf_under_two_keys_and_in_two_programs(self):
        greet = build_greet()
        first = f.Program(name="first", router={"greet": greet, "hello": greet})
        second = f.Program(name="second", router={"hi": greet})

        for cli, key in [(first, "greet"), (first, "hello"), (second, "hi")]:
            result = invoke(cli, key, "--json", '{"name":"world"}')
            assert json.loads(result.stdout) == {"greeting": "hello world"}

    def test_prints_the_version_through_custom_flags(self):
        cli = f.Program(
            name="myapp",
            version="1.2.3",
            version_option={"flags": "-v, --version"},
            router={},
        )

        result = invoke(cli, "-v")
        assert result.exit_code == 0
        assert result.stdout == "1.2.3\n"


def build_failing_leaf(render_error: RenderError | None = None):
    config: f.CommandConfig = {"name": "migrate"}
    if render_error is not None:
        config["render_error"] = render_error

    @f.command(**config)
    def migrate(input: Empty) -> Empty:
        raise RuntimeError("boom")

    return migrate


class TestProgramRenderError:
    def test_catches_an_error_from_a_nested_leaf(self):
        def render_error(error: Exception, context: f.Context) -> object:
            return {
                "error": str(error),
                "json": context.json,
                "command": context.command.name,
            }

        db = f.Program(name="db", router={"migrate": build_failing_leaf()})
        cli = f.Program(name="myapp", render_error=render_error, router={"db": db})

        result = invoke(cli, "db", "migrate", "--json")
        assert json.loads(result.stdout) == {
            "error": "boom",
            "json": True,
            "command": "migrate",
        }
        assert result.exit_code == 1

    def test_lets_a_leaf_own_hook_override_the_program_one(self):
        leaf = build_failing_leaf(render_error=lambda error, context: {"from": "leaf"})
        cli = f.Program(
            name="myapp",
            render_error=lambda error, context: {"from": "program"},
            router={"migrate": leaf},
        )

        result = invoke(cli, "migrate", "--json")
        assert json.loads(result.stdout) == {"from": "leaf"}

    def test_registers_the_hook_with_a_decorator(self):
        cli = f.Program(name="myapp", router={"migrate": build_failing_leaf()})

        @cli.render_error
        def show(error: Exception, context: f.Context) -> object:
            return f"failed: {error}"

        result = invoke(cli, "migrate")
        assert result.stderr == "failed: boom\n"
        assert result.exit_code == 1


class TestHelpGroupOrder:
    def test_lists_help_groups_in_order_of_first_appearance(self):
        ops = build_greet()
        ops.help_group = "Ops"
        cli = f.Program(name="app", router={"deploy": ops, "greet": build_greet()})

        help = invoke(cli, "--help").stdout
        assert help.index("Ops:") < help.index("Commands:")


class TestProgramRenderErrorContext:
    def test_calls_a_program_render_error_that_takes_only_the_error(self):
        class Empty(BaseModel):
            pass

        @f.command(name="fail")
        def fail(input: Empty) -> Empty:
            raise RuntimeError("boom")

        cli = f.Program(name="app", router={"fail": fail})

        @cli.render_error
        def render(error: Exception) -> str:
            return f"failed: {error}"

        result = invoke(cli, "fail")
        assert result.stderr == "failed: boom\n"
        assert result.exit_code == 1
