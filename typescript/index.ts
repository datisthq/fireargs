import { createArgument } from "./actions/argument/create.ts"
import { createCommand } from "./actions/command/create.ts"
import { createOption } from "./actions/option/create.ts"
import { createProgram } from "./actions/program/create.ts"

/**
 * The fireargs builder namespace. `f.command(config?)` opens a command
 * builder; `f.argument(config?)` and `f.option(config?)` open per-field
 * builders that produce zod schemas tagged with positional or `--option`
 * metadata respectively. `f.program(config?)` opens a program builder whose
 * `.router(...)` mounts commands and nested programs.
 */
export const f = {
  command: createCommand,
  argument: createArgument,
  option: createOption,
  program: createProgram,
}

export type { ArgumentConfig } from "./models/argument-config.ts"
export type { Command } from "./models/command.ts"
export type { CommandConfig } from "./models/config.ts"
export type { CommandContext, RenderContext } from "./models/context.ts"
export type { OptionConfig } from "./models/option-config.ts"
export type { Program } from "./models/program.ts"
export type { ProgramConfig } from "./models/program-config.ts"
export type { Route } from "./models/route.ts"
