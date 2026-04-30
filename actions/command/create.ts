import { z } from "zod"
import type { Command } from "../../models/command.ts"

/**
 * Open a chainable, type-stated command builder. Subsequent calls must go
 * `.input(z.object)` → `.output(z.object)` → `.handler(...)`; the terminal
 * `.handler` returns a `Command`.
 */
export function createCommand() {
  return {
    input<I extends z.ZodObject>(schema: I) {
      return createInputBuilder(schema)
    },
  }
}

function createInputBuilder<I extends z.ZodObject>(input: I) {
  return {
    output<O extends z.ZodObject>(schema: O) {
      return createOutputBuilder(input, schema)
    },
  }
}

function createOutputBuilder<I extends z.ZodObject, O extends z.ZodObject>(
  input: I,
  output: O,
) {
  return {
    handler(fn: (input: z.infer<I>) => z.infer<O> | Promise<z.infer<O>>) {
      const command: Command<z.infer<I>, z.infer<O>> = {
        input,
        output,
        handler: fn,
      }
      return command
    },
  }
}
