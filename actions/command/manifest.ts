import type { Command as CommanderCommand } from "commander"
import { z } from "zod"
import { FIREARGS_META_KEY } from "../../settings.ts"

/**
 * The per-command portion of the `--llms` manifest. The same shape is used
 * both as a standalone leaf manifest (with a wrapping `readme`) and as each
 * entry inside a program's `commands` map.
 */
export type CommandManifest = {
  command: { name?: string; description?: string; summary?: string }
  input: unknown
  output: unknown
}

const builders = new WeakMap<CommanderCommand, () => CommandManifest>()

/**
 * Register the manifest builder for a leaf commander Command. Called by
 * `compileCommand` after wiring; consumed by program-level compilers that
 * need each subcommand's full schema for their own `--llms` output.
 */
export function registerCommandManifest(
  cmd: CommanderCommand,
  input: z.ZodObject,
  output: z.ZodObject,
) {
  builders.set(cmd, () => buildCommandManifest(cmd, input, output))
}

/**
 * Read the manifest for a previously-registered leaf. Returns `undefined`
 * for commander Commands that weren't built via fireargs.
 */
export function readCommandManifest(cmd: CommanderCommand) {
  return builders.get(cmd)?.()
}

function buildCommandManifest(
  cmd: CommanderCommand,
  input: z.ZodObject,
  output: z.ZodObject,
): CommandManifest {
  const command: { name?: string; description?: string; summary?: string } = {}
  const name = cmd.name()
  if (name) command.name = name
  const description = cmd.description()
  if (description) command.description = description
  const summary = cmd.summary()
  if (summary) command.summary = summary
  return {
    command,
    input: z.toJSONSchema(input, { override: stripFireargsMeta }),
    output: z.toJSONSchema(output, { override: stripFireargsMeta }),
  }
}

function stripFireargsMeta(ctx: { jsonSchema: object }) {
  Reflect.deleteProperty(ctx.jsonSchema, FIREARGS_META_KEY)
}
