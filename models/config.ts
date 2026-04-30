/**
 * Commander-level configuration for a single command. All fields are
 * optional; unset values fall back to commander's defaults when the command
 * is compiled. Field-level concerns (argument descriptions, option flags,
 * defaults, choices) live in the input zod schema, not here.
 */
export type CommandConfig = {
  /** Command name shown in usage and help. Falls back to the router key. */
  name?: string
  /** Long-form description shown in `--help`. */
  description?: string
  /** One-line summary shown in subcommand listings; falls back to description. */
  summary?: string
  /** Alternate invocation names. */
  aliases?: string[]
  /** Overrides the auto-generated `Usage: ...` line. */
  usage?: string
  /** Version string (typically only set on the root command). */
  version?: string
  /** Customize the auto-help option. Pass `false` to disable. */
  helpOption?: { flags?: string; description?: string } | false
  /** Customize the auto-help subcommand. Pass `false` to disable. */
  helpCommand?: { name?: string; description?: string } | false
  /** Allow unknown `--options` without erroring. */
  allowUnknownOption?: boolean
  /** Allow more positional arguments than declared. */
  allowExcessArguments?: boolean
  /** Treat options after positionals as belonging to subcommands. */
  enablePositionalOptions?: boolean
  /** Stop option parsing at the first unknown token. */
  passThroughOptions?: boolean
  /** Allow `-fbar` and `--foo bar` shorthand. */
  combineFlagAndOptionalValue?: boolean
  /** Show full help (or a custom string) when an error occurs. */
  showHelpAfterError?: boolean | string
  /** Show "Did you mean…?" suggestions after errors. */
  showSuggestionAfterError?: boolean
}
