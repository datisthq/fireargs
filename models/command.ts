import type { z } from "zod"
import type { CommandConfig } from "./config.ts"

/**
 * A CLI command produced by the `f` builder. Carries commander-level config,
 * the input/output zod object schemas, and a handler that takes the parsed
 * input and must return a value matching the output schema.
 */
export type Command<I = unknown, O = unknown> = {
  config: CommandConfig
  input: z.ZodObject
  output: z.ZodObject
  handler: (input: I) => O | Promise<O>
}
