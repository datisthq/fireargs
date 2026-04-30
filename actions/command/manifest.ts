import type { Command as CommanderCommand } from "commander"
import { z } from "zod"
import { FIREARGS_META_KEY } from "../../settings.ts"

/**
 * One MCP-style tool entry in a `--llms` manifest. `name` is the
 * space-separated path the caller uses to reach the tool (e.g. `"api greet"`
 * for a leaf nested two levels deep). `inputSchema` and `outputSchema` are
 * JSON Schemas with fireargs metadata stripped.
 */
export type Tool = {
  name: string
  description?: string
  inputSchema: unknown
  outputSchema: unknown
}

/**
 * Top-level shape of `--llms` output. Matches MCP's `tools/list` response.
 * The first entry is a reserved `_usage` tool whose `description` carries
 * the calling convention — descriptions are first-class in MCP and always
 * surfaced to the model, so this is the most reliable place to put guidance.
 */
export type Manifest = {
  tools: Tool[]
}

/**
 * Build the reserved `_usage` tool that prefaces every manifest. Its name
 * starts with an underscore as a hint to LLM clients that it's a docstring,
 * not a callable; the schemas are empty so accidental invocation is a no-op.
 */
export function buildUsageTool(): Tool {
  return {
    name: "_usage",
    description:
      "Documentation tool, not callable. Each `tools[].name` is the space-separated path beneath this binary. Invoke a tool with `<binary> <name> --json '<value>'` matching that tool's `inputSchema`; output is JSON on stdout matching `outputSchema`.",
    inputSchema: { type: "object", properties: {} },
    outputSchema: { type: "object", properties: {} },
  }
}

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
 * Returns the flat list of tools at and below this Command. The empty
 * prefix `""` is used at the root of an `--llms` invocation; nested calls
 * pass the accumulated path.
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
  output: z.ZodObject,
  prefix: string,
): Tool {
  const tool: Tool = {
    name: prefix || cmd.name(),
    inputSchema: z.toJSONSchema(input, { override: stripFireargsMeta }),
    outputSchema: z.toJSONSchema(output, { override: stripFireargsMeta }),
  }
  const description = cmd.description()
  if (description) tool.description = description
  return tool
}

function stripFireargsMeta(ctx: { jsonSchema: object }) {
  Reflect.deleteProperty(ctx.jsonSchema, FIREARGS_META_KEY)
}
