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

const argumentMetaSchema = z.object({
  kind: z.literal("argument"),
  hidden: z.boolean().optional(),
  helpGroup: z.string().optional(),
  defaultDescription: z.string().optional(),
})

const optionMetaSchema = z.object({
  kind: z.literal("option"),
  short: z.string().optional(),
  env: z.string().optional(),
  conflicts: z.union([z.string(), z.array(z.string())]).optional(),
  implies: z.record(z.string(), z.unknown()).optional(),
  hidden: z.boolean().optional(),
  preset: z.unknown().optional(),
  helpGroup: z.string().optional(),
  defaultDescription: z.string().optional(),
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
  const raw = schema.meta()?.[FIREARGS_META_KEY]
  return fieldMetaSchema.safeParse(raw).data
}
