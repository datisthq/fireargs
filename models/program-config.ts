import type { CommandConfig } from "./config.ts"

/**
 * Commander-level configuration for a program (a root commander Command that
 * dispatches to subcommands). Same shape as `CommandConfig` minus the
 * input-side concerns: `arguments` (no input fields at the program level)
 * and `jsonOption` (programs dispatch — they don't read JSON input).
 */
export type ProgramConfig = Omit<CommandConfig, "arguments" | "jsonOption">
