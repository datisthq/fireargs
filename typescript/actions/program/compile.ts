import { Command as CommanderCommand, Option } from "commander"
import { Program } from "../../models/program.ts"
import type { ProgramConfig } from "../../models/program-config.ts"
import type { Route } from "../../models/route.ts"
import {
  type Tool,
  buildHelpTool,
  readManifestBuilder,
  registerManifestBuilder,
} from "../command/manifest.ts"
import { registerErrorHandler } from "../error/handle.ts"
import { inheritRouteSettings, mountRoute, registerRoute } from "../route/mount.ts"
import { readRoutePath } from "../route/read.ts"

/**
 * Build a fully-wired `Program` from a program config and a map of routes. Applies all `ProgramConfig` pass-throughs (identity,
 * help, hooks, behavior toggles, exit/output, `on`, `configureHelp`,
 * `addHelpText`/`addHelpCommand`/`addHelpOption`, `executableDir`,
 * `llmsOption`, `renderError`) and attaches each route under its object-key name.
 */
export function compileProgram(config: ProgramConfig, routes: Record<string, Route>) {
  const cmd = new Program(config.name)
  applyProgramConfig(cmd, config)
  const mounted: Record<string, Route> = {}
  for (const [key, sub] of Object.entries(routes)) {
    mounted[key] = mountRoute(cmd, key, sub)
  }
  wireDispatcher(cmd, config, mounted)
  registerManifestBuilder(cmd, prefix => collectTools(mounted, prefix))
  if (config.renderError !== undefined) registerErrorHandler(cmd, config.renderError)
  registerRoute(cmd, () => compileProgram(config, routes), config)
  inheritRouteSettings(cmd)
  return cmd
}

function collectTools(routes: Record<string, Route>, prefix: string) {
  const tools: Tool[] = []
  for (const [key, sub] of Object.entries(routes)) {
    const subPrefix = prefix ? `${prefix} ${key}` : key
    const subTools = readManifestBuilder(sub, subPrefix) ?? []
    tools.push(...subTools)
  }
  return tools
}

function applyProgramConfig(cmd: CommanderCommand, config: ProgramConfig) {
  if (config.description !== undefined) cmd.description(config.description)
  if (config.summary !== undefined) cmd.summary(config.summary)
  if (config.aliases !== undefined) cmd.aliases(config.aliases)
  if (config.helpGroup !== undefined) cmd.helpGroup(config.helpGroup)
  if (config.usage !== undefined) cmd.usage(config.usage)
  if (config.version !== undefined) {
    const vo = config.versionOption
    cmd.version(config.version, vo?.flags, vo?.description)
  }

  const ho = config.helpOption
  if (ho === false) cmd.helpOption(false)
  else if (ho !== undefined) cmd.helpOption(ho.flags, ho.description)

  const hc = config.helpCommand
  if (hc === false) cmd.helpCommand(false)
  else if (hc !== undefined) cmd.helpCommand(hc.name ?? "help", hc.description)

  if (config.allowUnknownOption) cmd.allowUnknownOption(true)
  if (config.allowExcessArguments) cmd.allowExcessArguments(true)
  if (config.enablePositionalOptions !== false) cmd.enablePositionalOptions(true)
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

  if (config.configureHelp !== undefined) cmd.configureHelp(config.configureHelp)

  if (config.addHelpText !== undefined) {
    const positions = ["beforeAll", "before", "after", "afterAll"] as const
    for (const position of positions) {
      const text = config.addHelpText[position]
      if (typeof text === "string") cmd.addHelpText(position, text)
      else if (text !== undefined) cmd.addHelpText(position, text)
    }
  }
  if (config.addHelpCommand !== undefined) cmd.addHelpCommand(config.addHelpCommand)
  if (config.addHelpOption !== undefined) cmd.addHelpOption(config.addHelpOption)
  if (config.exitOverride === true) cmd.exitOverride()
  else if (typeof config.exitOverride === "function") {
    cmd.exitOverride(config.exitOverride)
  }
  if (config.configureOutput !== undefined) {
    cmd.configureOutput(config.configureOutput)
  }
  if (config.executableDir !== undefined) cmd.executableDir(config.executableDir)
  if (config.on !== undefined) {
    for (const { event, listener } of config.on) cmd.on(event, listener)
  }
}

// Any action disables commander's implicit help command, its help on a bare program and
// its unknown-command error, so the dispatcher brings all three back
function wireDispatcher(
  cmd: CommanderCommand,
  config: ProgramConfig,
  routes: Record<string, Route>,
) {
  if (config.helpCommand === undefined && routes.help === undefined) cmd.helpCommand(true)
  cmd.allowExcessArguments(true)
  const llms = declareLlmsOption(cmd, config)

  cmd.action((options: Record<string, unknown>) => {
    const stray = cmd.args[0]
    if (stray !== undefined) {
      cmd.error(`error: unknown command '${stray}'`, { code: "commander.unknownCommand" })
    }
    if (llms === undefined || options[llms] !== true) cmd.help()
    const writer = cmd.configureOutput().writeOut ?? (s => process.stdout.write(s))
    const manifest = {
      tools: [buildHelpTool(false), ...collectTools(routes, readRoutePath(cmd))],
    }
    writer(`${JSON.stringify(manifest, null, 2)}\n`)
  })
}

function declareLlmsOption(cmd: CommanderCommand, config: ProgramConfig) {
  if (config.llmsOption === false) return undefined
  const flags = config.llmsOption?.flags ?? "--llms"
  const description =
    config.llmsOption?.description ??
    "print the program manifest (subcommand schemas) as JSON for LLM tool-use"
  const option = new Option(flags, description)
  cmd.addOption(option)
  return option.attributeName()
}
