from typing import Annotated, Literal

from pydantic import BaseModel

import fireargs as f


class EchoInput(BaseModel):
    path: Annotated[str, f.Argument(description="Path to read")]
    limit: Annotated[int, f.Option(short="l", ge=1, description="Rows to read")] = 20
    role: Annotated[
        Literal["admin", "user"] | None, f.Option(description="Role filter")
    ] = None
    verbose: Annotated[bool, f.Option(short="v")] = False
    header_rows: Annotated[int | None, f.Option(alias="headerRows")] = None


@f.command(description="Echo the input back")
def echo(input: EchoInput) -> EchoInput:
    return input


class StrictInput(BaseModel):
    count: Annotated[float, f.Option(ge=10)]


@f.command(description="Require a count of at least 10")
def strict(input: StrictInput) -> StrictInput:
    return input


class TagsInput(BaseModel):
    tags: Annotated[list[str], f.Option(parse=lambda value: value.split(","))] = []
    rows: list[int] = []
    loud: Annotated[bool | None, f.Option(conflicts="quiet", implies={"level": 3})] = None
    quiet: bool | None = None
    level: int | None = None
    color: Annotated[str | None, f.Option(flag_value="red")] = None


@f.command(description="Collect tags and rows")
def tags(input: TagsInput) -> TagsInput:
    return input


class ResetInput(BaseModel):
    force: Annotated[bool, f.Option(envvar="FIXTURE_FORCE")] = False
    backup: Annotated[bool, f.Option(envvar="FIXTURE_BACKUP")] = True


@f.command(description="Reset everything")
def reset(input: ResetInput) -> ResetInput:
    return input


fixture = f.Program(
    name="fixture",
    router={
        "echo": echo,
        "strict": strict,
        "tags": tags,
        "admin": f.Program(description="Admin tasks", router={"reset": reset}),
    },
)


class SoloInput(BaseModel):
    name: Annotated[str, f.Argument(description="Who to greet")] = "world"
    times: Annotated[
        int,
        f.Option(short="t", envvar="SOLO_TIMES", ge=1, description="Greetings to print"),
    ] = 1
    loud: bool = False


@f.command(name="solo", description="Greet someone", version="1.2.3")
def solo(input: SoloInput) -> SoloInput:
    return input


@solo.render
def render_solo(output: SoloInput) -> str:
    return "\n".join([f"Hello, {output.name}!"] * output.times)
