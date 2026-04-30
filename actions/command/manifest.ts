import type { Command as CommanderCommand } from "commander"
import { z } from "zod"
import { FIREARGS_META_KEY } from "../../settings.ts"

/**
 * Per-leaf manifest. Standalone leaves emit this directly; programs emit it
 * inside `commands[key]` for each leaf subcommand.
 */
export type CommandManifest = {
  command: { name?: string; description?: string; summary?: string }
  input: unknown
  output: unknown
}

/**
 * Per-program manifest. Recursive: `commands[key]` may itself be a
 * `ProgramManifest` when subcommand trees are nested, or a `CommandManifest`
 * for leaves.
 */
export type ProgramManifest = {
  program: {
    name?: string
    description?: string
    summary?: string
    version?: string
  }
  commands: Record<string, CommandManifest | ProgramManifest>
}

export type Manifest = CommandManifest | ProgramManifest

const builders = new WeakMap<CommanderCommand, () => Manifest>()

/**
 * Register a manifest builder for a commander Command produced by fireargs.
 * Both `compileCommand` (leaf) and `compileProgram` (subtree) call this so
 * `--llms` manifests compose recursively across nested programs.
 */
export function registerManifest(
  cmd: CommanderCommand,
  builder: () => Manifest,
) {
  builders.set(cmd, builder)
}

/**
 * Read the manifest for a previously-registered Command. Returns `undefined`
 * for commander Commands that weren't built via fireargs.
 */
export function readManifest(cmd: CommanderCommand) {
  return builders.get(cmd)?.()
}

/**
 * Build a leaf `CommandManifest` from a compiled commander Command and its
 * input/output zod schemas. The JSON Schemas are emitted via
 * `z.toJSONSchema` with fireargs metadata stripped.
 */
export function buildCommandManifest(
  cmd: CommanderCommand,
  input: z.ZodObject,
  output: z.ZodObject,
): CommandManifest {
  const command: CommandManifest["command"] = {}
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
