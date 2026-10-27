/**
 * Per-option commander config that can't be derived from a zod schema —
 * short flag, env-var binding, cross-field constraints, help-presentation
 * hints and a CLI-only value parser. Attached to an input field via
 * `createOption(config).{type}()`.
 */
export type OptionConfig<V = unknown> = {
  /** Long flag without dashes (`"to"` → `--to`). Defaults to the kebab-case key. */
  name?: string
  /** Short flag letter, e.g. `"v"` → adds `-v` to `--verbose`. */
  short?: string
  /** Environment variable to fall back to when the flag is absent. */
  env?: string
  /** Other option name(s) that conflict with this one; `--json` input skips the check. */
  conflicts?: string | string[]
  /** Other option values implied when this option is set; `--json` input skips them. */
  implies?: Record<string, unknown>
  /** Hide from `--help` output. */
  hidden?: boolean
  /** Preset value used when the flag appears without an argument. */
  preset?: unknown
  /** Group heading under which this option is listed in help. */
  helpGroup?: string
  /** Display string for the default value in help (overrides the literal). */
  defaultDescription?: string
  /** Turn the CLI string into the schema's input; `--json` input skips it. */
  parse?: (value: string) => V
}
