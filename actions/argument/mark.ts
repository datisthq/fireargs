import type { z } from "zod"
import { FIREARGS_META_KEY } from "../../settings.ts"

/**
 * Mark a zod schema so the parser maps its enclosing field to a positional
 * CLI argument. Unmarked schemas default to `--options`. Returns the same
 * schema instance (metadata lives in zod's global registry), so `z.infer`
 * flows through unchanged.
 */
export function markArgument<T extends z.ZodType>(schema: T) {
  return schema.meta({ [FIREARGS_META_KEY]: true })
}
