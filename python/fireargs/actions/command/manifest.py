from typing import NotRequired, TypedDict

from pydantic import BaseModel
from pydantic.json_schema import GenerateJsonSchema
from pydantic_core import core_schema

from ...models.command import Command, Leaf
from ...models.program import Program


class Tool(TypedDict):
    """One MCP-style tool in a `--llms` manifest; `name` is the space-separated path."""

    name: str
    inputSchema: dict[str, object]
    outputSchema: dict[str, object]
    description: NotRequired[str]


class Manifest(TypedDict):
    """The shape `--llms` prints, matching MCP's `tools/list` response."""

    tools: list[Tool]


def build_manifest(route: Leaf | Program, prefix: str) -> Manifest:
    """Build the `--llms` manifest of a route: the `help` tool, then every leaf below it."""
    return {"tools": [build_help_tool(), *collect_tools(route, prefix)]}


def build_help_tool() -> Tool:
    """Build the reserved `help` tool whose description carries the calling convention."""
    return {
        "name": "help",
        "description": "Documentation tool, not callable. Each `tools[].name` is the space-separated path beneath this binary. Invoke a tool with `<binary> <name> --json '<value>'` matching that tool's `inputSchema`; output is JSON on stdout matching `outputSchema`.",
        "inputSchema": {"type": "object", "properties": {}},
        "outputSchema": {"type": "object", "properties": {}},
    }


def collect_tools(route: Leaf | Program, prefix: str) -> list[Tool]:
    """List the leaf tools at and below a route, each named by its path from the root."""
    if isinstance(route, Program):
        tools: list[Tool] = []
        for key, sub in route.routes.items():
            tools.extend(collect_tools(sub, f"{prefix} {key}" if prefix else key))
        return tools
    if isinstance(route, Command):
        return [build_leaf_tool(route, prefix)]
    return []


def build_leaf_tool[I: BaseModel, O](command: Command[I, O], prefix: str) -> Tool:
    """Build a leaf's tool from its input model and output type."""
    tool: Tool = {
        "name": prefix or command.name or "",
        "inputSchema": command.input.model_json_schema(mode="validation"),
        "outputSchema": command.output.json_schema(
            mode="serialization", schema_generator=OutputJsonSchema
        ),
    }
    if command.help:
        tool["description"] = command.help
    return tool


class OutputJsonSchema(GenerateJsonSchema):
    """Output schemas mark defaulted fields required, as the output always carries them,
    except `X | None = None` optionals, which `--json` output leaves out."""

    def field_is_required(
        self,
        field: core_schema.ModelField
        | core_schema.DataclassField
        | core_schema.TypedDictField,
        total: bool,
    ) -> bool:
        schema = field["schema"]
        if self.mode != "serialization" or schema["type"] != "default":
            return super().field_is_required(field, total)
        return schema.get("default") is not None
