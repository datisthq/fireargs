import type { z } from "zod"
import { FIREARGS_META_KEY, type FieldMeta } from "./read.ts"

/**
 * Attach fireargs metadata to a zod schema. Returns the same schema instance
 * (metadata lives in zod's global registry) so `z.infer` is preserved.
 */
export function writeFieldMeta<T extends z.ZodType>(
  schema: T,
  meta: FieldMeta,
) {
  return schema.meta({ [FIREARGS_META_KEY]: meta })
}
