import type { z } from "zod"

/**
 * A CLI command produced by the `f` builder. Carries the input/output zod
 * object schemas and a handler that takes the parsed input and must return a
 * value matching the output schema.
 */
export type Command<I = unknown, O = unknown> = {
  input: z.ZodObject
  output: z.ZodObject
  handler: (input: I) => O | Promise<O>
}
