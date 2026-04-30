import { createArgument } from "./actions/argument/create.ts"
import { createCommand } from "./actions/command/create.ts"
import { createOption } from "./actions/option/create.ts"

/**
 * The fireargs builder namespace. `f.command(config?)` opens a command
 * builder; `f.argument(config?)` and `f.option(config?)` open per-field
 * builders that produce zod schemas tagged with positional or `--option`
 * metadata respectively.
 */
export const f = {
  command: createCommand,
  argument: createArgument,
  option: createOption,
}

export type { ArgumentConfig } from "./models/argument-config.ts"
export type { CommandConfig } from "./models/config.ts"
export type { OptionConfig } from "./models/option-config.ts"
