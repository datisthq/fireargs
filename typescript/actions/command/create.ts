import type { z } from "zod"
import type { CommandConfig } from "../../models/config.ts"
import { compileCommand, type Handler, type Render } from "./compile.ts"

/**
 * Open a chainable, type-stated command builder. Pass commander-level config
 * here, then chain `.input(z.object)` → `.output(zod)` → optional `.render(...)`
 * → `.handler(...)`; the terminal `.handler` returns the fully-wired commander
 * `Command`.
 */
export function createCommand(config: CommandConfig = {}) {
  return {
    input<I extends z.ZodObject>(schema: I) {
      return createInputBuilder(config, schema)
    },
  }
}

function createInputBuilder<I extends z.ZodObject>(config: CommandConfig, input: I) {
  return {
    output<O extends z.ZodType>(schema: O) {
      return createOutputBuilder(config, input, schema)
    },
  }
}

function createOutputBuilder<I extends z.ZodObject, O extends z.ZodType>(
  config: CommandConfig,
  input: I,
  output: O,
) {
  return {
    render(fn: Render<I, O>) {
      return createHandlerBuilder(config, input, output, fn)
    },
    ...createHandlerBuilder(config, input, output, undefined),
  }
}

function createHandlerBuilder<I extends z.ZodObject, O extends z.ZodType>(
  config: CommandConfig,
  input: I,
  output: O,
  render: Render<I, O> | undefined,
) {
  return {
    handler(fn: Handler<I, O>) {
      return compileCommand(config, input, output, fn, render)
    },
  }
}
