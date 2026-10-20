import type { Command as CommanderCommand } from "commander"
import type { CommandConfig } from "../../models/config.ts"
import type { CommandContext } from "../../models/context.ts"

type RenderError = NonNullable<CommandConfig["renderError"]>

const handlers = new WeakMap<CommanderCommand, RenderError>()

/**
 * Route a failed run to the nearest `renderError` hook, or rethrow when
 * there is none. Writes what the hook returns and sets the exit code to 1.
 */
export async function handleError(
  cmd: CommanderCommand,
  error: unknown,
  ctx: CommandContext,
) {
  const renderError = findErrorHandler(cmd)
  if (renderError === undefined) throw error

  const rendered = await renderError(error, ctx)
  const output = cmd.configureOutput()
  if (ctx.json && rendered !== undefined) {
    const writer = output.writeOut ?? (s => process.stdout.write(s))
    writer(`${JSON.stringify(rendered, null, 2)}\n`)
  } else if (typeof rendered === "string") {
    const writer = output.writeErr ?? (s => process.stderr.write(s))
    writer(`${rendered}\n`)
  }

  // Not process.exit: it can cut off stdout still draining into a pipe
  process.exitCode = 1
}

/**
 * Register a command's or program's `renderError` hook.
 */
export function registerErrorHandler(cmd: CommanderCommand, renderError: RenderError) {
  handlers.set(cmd, renderError)
}

// Looked up at run time: a leaf is compiled before the program that mounts it
function findErrorHandler(cmd: CommanderCommand) {
  for (let c: CommanderCommand | null = cmd; c !== null; c = c.parent) {
    const renderError = handlers.get(c)
    if (renderError !== undefined) return renderError
  }
  return undefined
}
