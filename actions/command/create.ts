import type { z } from "zod"
import type { CommandConfig } from "../../models/config.ts"
import { compileCommand } from "./compile.ts"

/**
 * Open a chainable, type-stated command builder. Pass commander-level config
 * here, then chain `.input(z.object)` → `.output(z.object)` → `.handler(...)`;
 * the terminal `.handler` returns the fully-wired commander `Command`.
 */
export function createCommand(config: CommandConfig = {}) {
  return {
    input<I extends z.ZodObject>(schema: I) {
      return createInputBuilder(config, schema)
    },
  }
}

function createInputBuilder<I extends z.ZodObject>(
  config: CommandConfig,
  input: I,
) {
  return {
    output<O extends z.ZodObject>(schema: O) {
      return createOutputBuilder(config, input, schema)
    },
  }
}

function createOutputBuilder<I extends z.ZodObject, O extends z.ZodObject>(
  config: CommandConfig,
  input: I,
  output: O,
) {
  return {
    handler(fn: (input: z.infer<I>) => z.infer<O> | Promise<z.infer<O>>) {
      return compileCommand(config, input, output, fn)
    },
  }
}
