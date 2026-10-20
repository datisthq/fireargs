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


class ResetInput(BaseModel):
    force: bool = False


@f.command(description="Reset everything")
def reset(input: ResetInput) -> ResetInput:
    return input


fixture = f.Program(
    name="fixture",
    router={
        "echo": echo,
        "strict": strict,
        "admin": f.Program(description="Admin tasks", router={"reset": reset}),
    },
)
