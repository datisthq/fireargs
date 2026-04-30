import type { ArgumentConfig } from "../../models/argument-config.ts"
import { createFieldBuilder } from "../field/create.ts"

/**
 * Open a per-field builder that produces zod schemas tagged as positional
 * CLI arguments with the given config. Use the type method that matches the
 * value shape (`.string()`, `.number()`, `.boolean()`, `.enum(...)`,
 * `.array(inner)`, or `.schema(custom)` for arbitrary zod types).
 */
export function createArgument(config: ArgumentConfig = {}) {
  return createFieldBuilder({ kind: "argument", ...config })
}
