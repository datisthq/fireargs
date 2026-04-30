import type { Command as CommanderCommand } from "commander"
import type { ProgramConfig } from "../../models/program-config.ts"
import { compileProgram } from "./compile.ts"

/**
 * Open a program builder for a CLI tree. Pass commander-level config here,
 * then call `.commands({ ... })` with a map of subcommands. The terminal
 * `.commands(...)` returns a fully-wired commander root `Command`. Each
 * subcommand is attached under its object key (overriding the leaf's own
 * `name(...)` if set).
 */
export function createProgram(config: ProgramConfig = {}) {
  return {
    commands(commands: Record<string, CommanderCommand>) {
      return compileProgram(config, commands)
    },
  }
}
