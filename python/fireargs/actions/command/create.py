import inspect
from collections.abc import Awaitable, Callable
from typing import Unpack, get_type_hints, overload

from pydantic import BaseModel, TypeAdapter

from ...models.command import Command
from ...models.config import CommandConfig
from ...models.context import Context
from .compile import compile_command


@overload
def create_command[I: BaseModel, O](
    handler: Callable[[I], Awaitable[O]], /
) -> Command[I, O]: ...
@overload
def create_command[I: BaseModel, O](
    handler: Callable[[I, Context], Awaitable[O]], /
) -> Command[I, O]: ...
@overload
def create_command[I: BaseModel, O](handler: Callable[[I], O], /) -> Command[I, O]: ...
@overload
def create_command[I: BaseModel, O](
    handler: Callable[[I, Context], O], /
) -> Command[I, O]: ...
@overload
def create_command(
    handler: None = None, /, **config: Unpack[CommandConfig]
) -> "CommandBuilder": ...
def create_command(
    handler: Callable[..., object] | None = None, /, **config: Unpack[CommandConfig]
):
    """Open a command decorator: the decorated handler's first parameter annotation is the
    input model and its return annotation the output type; a second parameter receives
    the `Context`. Bare `@command` takes the default config."""
    builder = CommandBuilder(config)
    return builder if handler is None else builder(handler)


class CommandBuilder:
    """Turns a handler into a `Command`; returned by `command(...)`."""

    def __init__(self, config: CommandConfig) -> None:
        self.config = config

    @overload
    def __call__[I: BaseModel, O](
        self, handler: Callable[[I], Awaitable[O]]
    ) -> Command[I, O]: ...
    @overload
    def __call__[I: BaseModel, O](
        self, handler: Callable[[I, Context], Awaitable[O]]
    ) -> Command[I, O]: ...
    @overload
    def __call__[I: BaseModel, O](self, handler: Callable[[I], O]) -> Command[I, O]: ...
    @overload
    def __call__[I: BaseModel, O](
        self, handler: Callable[[I, Context], O]
    ) -> Command[I, O]: ...
    def __call__(self, handler: Callable[..., object]):
        hints = get_type_hints(handler, include_extras=True)
        parameters = list(inspect.signature(handler).parameters.values())
        if not parameters or len(parameters) > 2:
            raise TypeError("a handler takes the input and, optionally, the context")
        input = hints.get(parameters[0].name)
        if not (isinstance(input, type) and issubclass(input, BaseModel)):
            raise TypeError(
                "annotate the handler's first parameter with a pydantic model"
            )
        if "return" not in hints:
            raise TypeError("annotate the handler's return type; it is the output schema")
        return compile_command(
            self.config,
            handler,
            input,
            TypeAdapter(hints["return"]),
            takes_context=len(parameters) == 2,
        )
