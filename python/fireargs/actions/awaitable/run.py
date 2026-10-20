import asyncio
import inspect
from collections.abc import Awaitable


def run_awaitable[T](value: T | Awaitable[T]) -> T:
    """Resolve what a sync or async handler, render or hook returned, from click's sync
    callback."""
    if not inspect.isawaitable(value):
        return value

    async def wait() -> T:
        return await value

    return asyncio.run(wait())
