import { createCommand } from "./actions/command/create.ts"

/**
 * The fireargs builder namespace. Use `f.command(config?)` to start defining
 * a command. Mark positional arguments via `config.arguments`.
 */
export const f = {
  command: createCommand,
}

export type { Command } from "./models/command.ts"
export type { CommandConfig } from "./models/config.ts"
