import { z } from "zod"
import type { ArgumentConfig } from "../../models/argument-config.ts"
import type { OptionConfig } from "../../models/option-config.ts"
import { FIREARGS_META_KEY } from "../../settings.ts"

/**
 * Discriminated metadata fireargs writes onto an input field schema. `kind`
 * routes the field to commander's `.argument()` or `.option()` API; the rest
 * is the per-field config the user supplied.
 */
export type FieldMeta =
  | ({ kind: "argument" } & ArgumentConfig)
  | ({ kind: "option" } & OptionConfig)

const parseSchema = z.custom<(value: string) => unknown>(v => typeof v === "function")

const argumentMetaSchema = z.object({
  kind: z.literal("argument"),
  name: z.string().optional(),
  hidden: z.boolean().optional(),
  helpGroup: z.string().optional(),
  defaultDescription: z.string().optional(),
  parse: parseSchema.optional(),
})

const optionMetaSchema = z.object({
  kind: z.literal("option"),
  name: z.string().optional(),
  short: z.string().optional(),
  env: z.string().optional(),
  conflicts: z.union([z.string(), z.array(z.string())]).optional(),
  implies: z.record(z.string(), z.unknown()).optional(),
  hidden: z.boolean().optional(),
  preset: z.unknown().optional(),
  helpGroup: z.string().optional(),
  defaultDescription: z.string().optional(),
  parse: parseSchema.optional(),
})

const fieldMetaSchema: z.ZodType<FieldMeta> = z.discriminatedUnion("kind", [
  argumentMetaSchema,
  optionMetaSchema,
])

/**
 * Read fireargs metadata previously attached by `createArgument` or
 * `createOption`. Returns `undefined` for unmarked schemas — the compiler
 * treats those as default `--option` fields.
 */
export function readFieldMeta(schema: z.ZodType) {
  const raw = findSchemaMeta(schema, meta => meta[FIREARGS_META_KEY] !== undefined)
  return fieldMetaSchema.safeParse(raw?.[FIREARGS_META_KEY]).data
}

/**
 * Read a field's description, set on it or on any schema it wraps.
 */
export function readFieldDescription(schema: z.ZodType) {
  const meta = findSchemaMeta(schema, meta => meta.description !== undefined)
  return meta?.description
}

// zod keeps meta on the instance it was set on, and a wrapper made after it
// (`.default()`, `.optional()`…) starts empty: `f.option().boolean().default(false)`
function findSchemaMeta(
  schema: z.core.$ZodType,
  test: (meta: z.core.GlobalMeta) => boolean,
): z.core.GlobalMeta | undefined {
  const meta = z.globalRegistry.get(schema)
  if (meta !== undefined && test(meta)) return meta
  const inner = unwrapSchema(schema)
  return inner === undefined ? undefined : findSchemaMeta(inner, test)
}

function unwrapSchema(schema: z.core.$ZodType) {
  if (
    schema instanceof z.ZodOptional ||
    schema instanceof z.ZodNullable ||
    schema instanceof z.ZodDefault ||
    schema instanceof z.ZodPrefault ||
    schema instanceof z.ZodNonOptional ||
    schema instanceof z.ZodCatch ||
    schema instanceof z.ZodReadonly
  ) {
    return schema.unwrap()
  }
  if (schema instanceof z.ZodPipe) return schema.in
  return undefined
}
