/**
 * Per-argument commander config that can't be derived from a zod schema.
 * Commander's `Argument` exposes far fewer slots than `Option`: no short
 * flag, no env, no conflicts/implies, no hidden, no helpGroup. The only
 * presentation slot worth surfacing is the default-value description shown
 * in help.
 */
export type ArgumentConfig = {
  /** Display string for the default value in help (overrides the literal). */
  defaultDescription?: string
}
