import type {
  AddHelpTextContext,
  AddHelpTextPosition,
  Command as CommanderCommand,
  CommanderError,
  HelpConfiguration,
  Option,
  OutputConfiguration,
} from "commander"

/**
 * Commander-level configuration for a single command. All fields are
 * optional; unset values fall back to commander's defaults when the command
 * is compiled. Per-field concerns (descriptions, defaults, choices) live in
 * the input zod schema; the only field-routing decision that lives here is
 * which keys are positional arguments via `arguments`.
 */
export type CommandConfig = {
  /** Command name shown in usage and help. Falls back to the router key. */
  name?: string
  /**
   * Input-schema property keys that should be parsed as positional
   * arguments, in declaration order. Keys not listed become `--options`.
   */
  arguments?: string[]
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
  /** Runs before a subcommand is dispatched. Forwarded to `cmd.hook("preSubcommand", ...)`. */
  preSubcommand?: (
    thisCommand: CommanderCommand,
    subcommand: CommanderCommand,
  ) => void | Promise<void>
  /** Runs before the action callback. Forwarded to `cmd.hook("preAction", ...)`. */
  preAction?: (
    thisCommand: CommanderCommand,
    actionCommand: CommanderCommand,
  ) => void | Promise<void>
  /** Runs after the action callback. Forwarded to `cmd.hook("postAction", ...)`. */
  postAction?: (
    thisCommand: CommanderCommand,
    actionCommand: CommanderCommand,
  ) => void | Promise<void>
  /**
   * Override commander's help formatting. Forwarded verbatim to
   * `cmd.configureHelp(...)`. See commander's `Help` class for the
   * properties and methods that can be overridden (e.g. `helpWidth`,
   * `sortOptions`, `optionTerm`, `formatHelp`).
   */
  configureHelp?: HelpConfiguration
  /** Extra help paragraphs by position. Forwarded to `cmd.addHelpText(...)`. */
  addHelpText?: Partial<
    Record<
      AddHelpTextPosition,
      string | ((context: AddHelpTextContext) => string)
    >
  >
  /** Replace commander's auto-generated help subcommand with a pre-built one. */
  addHelpCommand?: CommanderCommand
  /** Replace commander's auto-generated `--help` option with a pre-built one. */
  addHelpOption?: Option
  /**
   * Throw `CommanderError` instead of calling `process.exit`. Pass `true` for
   * the bare-throw form, or a callback to handle the error yourself.
   */
  exitOverride?: boolean | ((err: CommanderError) => void)
  /** Custom output streams / formatters. Forwarded to `cmd.configureOutput(...)`. */
  configureOutput?: OutputConfiguration
  /** Directory used to resolve stand-alone subcommand executables. */
  executableDir?: string
  /**
   * Non-lifecycle event listeners (e.g. `option:port`, `command:*`). Each
   * entry is registered via `cmd.on(event, listener)`.
   */
  on?: Array<{ event: string; listener: (...args: unknown[]) => void }>
}
