/**
 * Per-argument commander config that can't be derived from a zod schema.
 * Commander's `Argument` exposes far fewer slots than `Option`: no short
 * flag, no env, no conflicts/implies, no hidden, no helpGroup. What remains
 * is the default-value description shown in help and a CLI-only value parser.
 */
export type ArgumentConfig<V = unknown> = {
  /** Display string for the default value in help (overrides the literal). */
  defaultDescription?: string
  /** Turn the CLI string into the schema's input; `--json` input skips it. */
  parse?: (value: string) => V
}
