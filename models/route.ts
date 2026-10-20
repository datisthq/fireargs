import type { Command } from "./command.ts"
import type { Program } from "./program.ts"

/**
 * Anything a program can route to: a leaf command or a nested program.
 */
export type Route = Command | Program
