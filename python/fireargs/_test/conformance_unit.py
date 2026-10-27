import json
from pathlib import Path
from typing import Literal, NotRequired, TypedDict

import jsonschema
import pytest
from click.testing import CliRunner

from .fixture import fixture, solo

SUITE = Path(__file__).parents[3] / "conformance"


class ToolEntry(TypedDict):
    name: str
    description: NotRequired[str]


class Instance(TypedDict):
    tool: str
    io: Literal["input", "output"]
    data: object
    valid: bool


class Case(TypedDict):
    description: str
    fixture: NotRequired[Literal["program", "command"]]
    argv: list[str]
    env: NotRequired[dict[str, str]]
    exitCode: int
    stdout: NotRequired[object]
    stdoutText: NotRequired[str]
    stderr: NotRequired[str]
    tools: NotRequired[list[ToolEntry]]
    instances: NotRequired[list[Instance]]


def list_files():
    return sorted((SUITE / "tests").glob("*/*.json"))


def list_cases():
    for path in list_files():
        for group in json.loads(path.read_text()):
            for case in group["tests"]:
                label = f"{path.parent.name}/{path.name} › {group['description']} › {case['description']}"
                yield pytest.param(case, id=label)


class TestConformance:
    @pytest.mark.parametrize("path", list_files(), ids=lambda path: path.name)
    def test_file_matches_the_test_schema(self, path: Path):
        schema = json.loads((SUITE / "test-schema.json").read_text())
        jsonschema.validate(json.loads(path.read_text()), schema)

    @pytest.mark.parametrize("case", list_cases())
    def test_case(self, case: Case):
        cli = solo if case.get("fixture") == "command" else fixture
        result = CliRunner().invoke(
            cli, case["argv"], env=case.get("env"), prog_name=cli.name
        )
        assert result.exit_code == case["exitCode"], result.output
        if "stdout" in case:
            assert json.loads(result.stdout) == case["stdout"]
        if "stdoutText" in case:
            assert result.stdout == case["stdoutText"]
        if "stderr" in case:
            assert result.stderr.startswith(case["stderr"]), result.stderr
        if "tools" not in case and "instances" not in case:
            return

        tools = json.loads(result.stdout)["tools"]
        if "tools" in case:
            names = [
                {"name": tool["name"], "description": tool.get("description")}
                for tool in tools
            ]
            assert names == [
                {"name": tool["name"], "description": tool.get("description")}
                for tool in case["tools"]
            ]
        for instance in case.get("instances", []):
            tool = next(tool for tool in tools if tool["name"] == instance["tool"])
            schema = tool["inputSchema" if instance["io"] == "input" else "outputSchema"]
            valid = jsonschema.Draft202012Validator(schema).is_valid(instance["data"])
            assert valid is instance["valid"], (
                f"{instance['tool']} {instance['io']} {instance['data']}"
            )
