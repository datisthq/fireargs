import type { OptionConfig } from "../../models/option-config.ts"
import { createFieldBuilder } from "../field/create.ts"

/**
 * Open a per-field builder that produces zod schemas tagged as `--option`
 * fields with the given config (short flag, env var, conflicts, implies,
 * preset, parse, etc.). Use the type method matching the value shape
 * (`.string()`, `.number()`, `.boolean()`, `.enum(...)`, `.array(inner)`, or
 * `.schema()` for arbitrary zod).
 */
export function createOption<const V = never>(config: OptionConfig<V> = {}) {
  return createFieldBuilder<V>({ kind: "option", ...config })
}
