/**
 * The key under which fireargs stores per-schema metadata in zod's global
 * registry. Reading or writing this slot is the only contract between the
 * builder (`createArgument` / `createOption`) and the compiler.
 */
export const FIREARGS_META_KEY = "fireargs"
