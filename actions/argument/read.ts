import type { z } from "zod"
import { FIREARGS_META_KEY } from "../../settings.ts"

/**
 * Returns `true` when `markArgument` was applied to the given schema.
 */
export function isArgument(schema: z.ZodType) {
  return schema.meta()?.[FIREARGS_META_KEY] === true
}
