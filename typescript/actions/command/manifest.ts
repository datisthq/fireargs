import type { Command as CommanderCommand } from "commander"
import { z } from "zod"
import { FIREARGS_META_KEY } from "../../settings.ts"

/**
 * One MCP-style tool entry in a `--llms` manifest. `name` is the
 * space-separated path the caller uses to reach the tool (e.g. `"api greet"`
 * for a leaf nested two levels deep). `inputSchema` (what `--json` accepts) and
 * `outputSchema` are JSON Schemas with fireargs metadata stripped.
 */
export type Tool = {
  name: string
  description?: string
  inputSchema: unknown
  outputSchema: unknown
}

/**
 * Top-level shape of `--llms` output. Matches MCP's `tools/list` response.
 * The first entry is a reserved `help` tool whose `description` carries the
 * calling convention — descriptions are first-class in MCP and always
 * surfaced to the model, so this is the most reliable place to put guidance.
 */
export type Manifest = {
  tools: Tool[]
}

/**
 * Build the reserved `help` tool that prefaces every manifest. The schemas
 * are empty so accidental invocation is a no-op; the description tells
 * model-readers it's documentation rather than a callable, and how to call the
 * tools: by their path beneath the binary, or as the binary itself when the
 * manifest comes from a standalone command.
 */
export function buildHelpTool(standalone: boolean): Tool {
  return {
    name: "help",
    description: standalone ? STANDALONE_HELP : PROGRAM_HELP,
    inputSchema: { type: "object", properties: {} },
    outputSchema: { type: "object", properties: {} },
  }
}

const PROGRAM_HELP =
  "Documentation tool, not callable. Each `tools[].name` is the space-separated path beneath this binary. Invoke a tool with `<binary> <name> --json '<value>'` matching that tool's `inputSchema`; output is JSON on stdout matching `outputSchema`."

const STANDALONE_HELP =
  "Documentation tool, not callable. The other tool is this binary itself. Invoke it with `<binary> --json '<value>'` matching that tool's `inputSchema`; output is JSON on stdout matching `outputSchema`."

const builders = new WeakMap<CommanderCommand, (prefix: string) => Tool[]>()

/**
 * Register a tools builder for a fireargs-built commander Command. Both
 * leaf compilers and program compilers register one; `compileProgram`
 * walks subcommands by calling each child's builder with the path-prefix
 * accumulated so far.
 */
export function registerManifestBuilder(
  cmd: CommanderCommand,
  builder: (prefix: string) => Tool[],
) {
  builders.set(cmd, builder)
}

/**
 * Invoke the registered tools builder for a Command with a path prefix.
 * Returns the flat list of tools at and below this Command, named by the
 * path from the root program; the empty prefix `""` is the root itself.
 */
export function readManifestBuilder(cmd: CommanderCommand, prefix: string) {
  return builders.get(cmd)?.(prefix)
}

/**
 * Build a leaf `Tool` from a compiled commander Command and its
 * input/output zod schemas. Used by the leaf compiler's registered builder.
 */
export function buildLeafTool(
  cmd: CommanderCommand,
  input: z.ZodObject,
  output: z.ZodType,
  prefix: string,
): Tool {
  const tool: Tool = {
    name: prefix || cmd.name(),
    inputSchema: z.toJSONSchema(input, {
      io: "input",
      unrepresentable: "any",
      override: stripFireargsMeta,
    }),
    outputSchema: z.toJSONSchema(output, {
      io: "output",
      unrepresentable: "any",
      override: stripFireargsMeta,
    }),
  }
  const description = cmd.description()
  if (description) tool.description = description
  return tool
}

function stripFireargsMeta(ctx: { jsonSchema: object }) {
  Reflect.deleteProperty(ctx.jsonSchema, FIREARGS_META_KEY)
}
