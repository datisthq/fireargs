import { z } from "zod"
import type { FieldMeta } from "./read.ts"
import { writeFieldMeta } from "./write.ts"

/**
 * Build a per-field builder that emits zod schemas tagged with the given
 * fireargs metadata. The methods mirror common zod constructors and return
 * schemas already wrapped in `z.meta({ fireargs: meta })`.
 */
export function createFieldBuilder(meta: FieldMeta) {
  return {
    string: () => writeFieldMeta(z.string(), meta),
    number: () => writeFieldMeta(z.number(), meta),
    boolean: () => writeFieldMeta(z.boolean(), meta),
    enum: <const T extends readonly [string, ...string[]]>(values: T) =>
      writeFieldMeta(z.enum(values), meta),
    array: <T extends z.ZodType>(inner: T) =>
      writeFieldMeta(z.array(inner), meta),
    schema: <T extends z.ZodType>(schema: T) => writeFieldMeta(schema, meta),
  }
}
