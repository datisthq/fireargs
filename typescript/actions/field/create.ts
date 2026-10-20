import { z } from "zod"
import type { FieldMeta } from "./read.ts"
import { writeFieldMeta } from "./write.ts"

/**
 * Build a per-field builder that emits zod schemas tagged with the given
 * fireargs metadata. The methods mirror common zod constructors and return
 * schemas already wrapped in `z.meta({ fireargs: meta })`. `V` is what the
 * field's `parse` returns; `.schema()` and `.array()` must accept it.
 */
export function createFieldBuilder<V = never>(meta: FieldMeta) {
  return {
    string: () => writeFieldMeta(z.string(), meta),
    number: () => writeFieldMeta(z.number(), meta),
    boolean: () => writeFieldMeta(z.boolean(), meta),
    enum: <const T extends readonly [string, ...string[]]>(values: T) =>
      writeFieldMeta(z.enum(values), meta),
    array: <T extends z.ZodType>(inner: T & AcceptParsed<z.ZodArray<T>, V>) =>
      writeFieldMeta(z.array(inner), meta),
    schema: <T extends z.ZodType>(schema: T & AcceptParsed<T, V>) =>
      writeFieldMeta(schema, meta),
  }
}

type AcceptParsed<T extends z.ZodType, V> = [V] extends [z.input<T>]
  ? unknown
  : { "parse returns a value this schema does not accept": V }
