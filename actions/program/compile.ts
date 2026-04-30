import { Command as CommanderCommand, Option } from "commander"
import type { ProgramConfig } from "../../models/program-config.ts"
import { readCommandManifest } from "../command/manifest.ts"

/**
 * Build a fully-wired commander root `Command` from a program config and a
 * map of subcommands. Applies all `ProgramConfig` pass-throughs (identity,
 * help, hooks, behavior toggles, exit/output, `on`, `configureHelp`,
 * `addHelpText`/`addHelpCommand`/`addHelpOption`, `executableDir`,
 * `llmsOption`) and attaches each subcommand under its object-key name.
 */
export function compileProgram(
  config: ProgramConfig,
  commands: Record<string, CommanderCommand>,
) {
  const cmd = new CommanderCommand(config.name)
  applyProgramConfig(cmd, config)
  declareLlmsOnProgram(cmd, config, commands)
  for (const [key, sub] of Object.entries(commands)) {
    sub.name(key)
    cmd.addCommand(sub)
  }
  return cmd
}

function applyProgramConfig(cmd: CommanderCommand, config: ProgramConfig) {
  if (config.description !== undefined) cmd.description(config.description)
  if (config.summary !== undefined) cmd.summary(config.summary)
  if (config.aliases !== undefined) cmd.aliases(config.aliases)
  if (config.usage !== undefined) cmd.usage(config.usage)
  if (config.version !== undefined) cmd.version(config.version)

  const ho = config.helpOption
  if (ho === false) cmd.helpOption(false)
  else if (ho !== undefined) cmd.helpOption(ho.flags, ho.description)

  const hc = config.helpCommand
  if (hc === false) cmd.helpCommand(false)
  else if (hc !== undefined) cmd.helpCommand(hc.name ?? "help", hc.description)

  if (config.allowUnknownOption) cmd.allowUnknownOption(true)
  if (config.allowExcessArguments) cmd.allowExcessArguments(true)
  if (config.enablePositionalOptions !== false)
    cmd.enablePositionalOptions(true)
  if (config.passThroughOptions) cmd.passThroughOptions(true)
  if (config.combineFlagAndOptionalValue) cmd.combineFlagAndOptionalValue(true)
  if (config.showHelpAfterError !== undefined) {
    cmd.showHelpAfterError(config.showHelpAfterError)
  }
  if (config.showSuggestionAfterError !== undefined) {
    cmd.showSuggestionAfterError(config.showSuggestionAfterError)
  }

  if (config.preSubcommand) cmd.hook("preSubcommand", config.preSubcommand)
  if (config.preAction) cmd.hook("preAction", config.preAction)
  if (config.postAction) cmd.hook("postAction", config.postAction)

  if (config.configureHelp !== undefined)
    cmd.configureHelp(config.configureHelp)

  if (config.addHelpText !== undefined) {
    const positions = ["beforeAll", "before", "after", "afterAll"] as const
    for (const position of positions) {
      const text = config.addHelpText[position]
      if (typeof text === "string") cmd.addHelpText(position, text)
      else if (text !== undefined) cmd.addHelpText(position, text)
    }
  }
  if (config.addHelpCommand !== undefined)
    cmd.addHelpCommand(config.addHelpCommand)
  if (config.addHelpOption !== undefined)
    cmd.addHelpOption(config.addHelpOption)
  if (config.exitOverride === true) cmd.exitOverride()
  else if (typeof config.exitOverride === "function") {
    cmd.exitOverride(config.exitOverride)
  }
  if (config.configureOutput !== undefined) {
    cmd.configureOutput(config.configureOutput)
  }
  if (config.executableDir !== undefined)
    cmd.executableDir(config.executableDir)
  if (config.on !== undefined) {
    for (const { event, listener } of config.on) cmd.on(event, listener)
  }
}

function declareLlmsOnProgram(
  cmd: CommanderCommand,
  config: ProgramConfig,
  commands: Record<string, CommanderCommand>,
) {
  if (config.llmsOption === false) return
  const flags = config.llmsOption?.flags ?? "--llms"
  const description =
    config.llmsOption?.description ??
    "print the program manifest (subcommand schemas) as JSON for LLM tool-use"
  cmd.addOption(new Option(flags, description))

  cmd.action((options: { llms?: boolean }) => {
    if (options.llms !== true) return
    const writer =
      cmd.configureOutput().writeOut ?? (s => process.stdout.write(s))
    writer(`${JSON.stringify(buildProgramManifest(cmd, commands), null, 2)}\n`)
  })
}

function buildProgramManifest(
  cmd: CommanderCommand,
  commands: Record<string, CommanderCommand>,
) {
  const program: Record<string, unknown> = {}
  const name = cmd.name()
  if (name) program.name = name
  const description = cmd.description()
  if (description) program.description = description
  const summary = cmd.summary()
  if (summary) program.summary = summary

  const commandsManifest: Record<string, unknown> = {}
  for (const [key, sub] of Object.entries(commands)) {
    const manifest = readCommandManifest(sub)
    if (manifest !== undefined) commandsManifest[key] = manifest
  }

  return {
    readme:
      "Each subcommand is invoked via `<cmd> <subcommand> --json '<value>'` matching that subcommand's `input` schema; output is JSON on stdout matching its `output` schema.",
    program,
    commands: commandsManifest,
  }
}
