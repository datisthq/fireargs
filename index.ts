import { createArgument } from "./actions/argument/create.ts"
import { createCommand } from "./actions/command/create.ts"

/**
 * The fireargs builder namespace. Use `f.command()` to start defining a
 * command and `f.argument(schema)` inside an input shape to mark a field as
 * a positional argument; unmarked fields default to `--options`.
 */
export const f = {
  argument: createArgument,
  command: createCommand,
}

export type { Command } from "./models/command.ts"
