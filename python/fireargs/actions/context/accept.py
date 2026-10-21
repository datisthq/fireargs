import inspect
from collections.abc import Callable
from typing_extensions import TypeIs


def accepts_context[T, C, R](
    fn: Callable[[T], R] | Callable[[T, C], R],
) -> TypeIs[Callable[[T, C], R]]:
    """Tell whether a render or `render_error` hook takes the context as a second
    argument; the context is optional, as it is for handlers."""
    try:
        parameters = inspect.signature(fn).parameters.values()
    except (TypeError, ValueError):
        return True
    positional = [
        p for p in parameters if p.kind in (p.POSITIONAL_ONLY, p.POSITIONAL_OR_KEYWORD)
    ]
    variadic = any(p.kind is p.VAR_POSITIONAL for p in parameters)
    return variadic or len(positional) >= 2
