import { markArgument } from "./actions/argument/mark.ts"
import { createCommandBuilder } from "./actions/command/define.ts"

/**
 * The fireargs builder namespace. Use `f.command()` to start defining a
 * command and `f.argument(schema)` inside an input shape to mark a field as
 * a positional argument; unmarked fields default to `--options`.
 */
export const f = {
  argument: markArgument,
  command: createCommandBuilder,
}

export type { Command } from "./models/command.ts"
