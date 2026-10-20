import type { Command } from "./command.ts"

/**
 * What a handler, `.render` or `renderError` knows about the run: whether
 * `--json` was given (with or without a value) and the leaf that is running.
 */
export type CommandContext = {
  json: boolean
  command: Command
}

/**
 * The context `.render` receives: a `CommandContext` plus the parsed input.
 */
export type RenderContext<I> = CommandContext & {
  input: I
}
