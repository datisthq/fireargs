import { Command as CommanderCommand } from "commander"
import { z } from "zod"
import type { CommandConfig } from "../../models/config.ts"

/**
 * Build a fully-wired commander `Command` from the fireargs builder state.
 * Applies config pass-throughs, declares arguments and options derived from
 * the input zod schema (with `config.arguments` selecting the positional
 * set), and wires the `.action(...)` callback to validate input via zod,
 * invoke the handler, and validate the return value via the output schema.
 */
export function compileCommand<I extends z.ZodObject, O extends z.ZodObject>(
  config: CommandConfig,
  input: I,
  output: O,
  handler: (input: z.infer<I>) => z.infer<O> | Promise<z.infer<O>>,
) {
  const cmd = new CommanderCommand(config.name)
  applyConfig(cmd, config)
  declareFields(cmd, config, input)
  wireAction(cmd, config, input, output, handler)
  return cmd
}

function applyConfig(cmd: CommanderCommand, config: CommandConfig) {
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
  if (config.enablePositionalOptions) cmd.enablePositionalOptions(true)
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
}

function declareFields(
  cmd: CommanderCommand,
  config: CommandConfig,
  input: z.ZodObject,
) {
  const argKeys = config.arguments ?? []
  const argSet = new Set(argKeys)

  for (const key of argKeys) {
    const schema = input.shape[key]
    if (schema !== undefined) declareArgument(cmd, key, schema)
  }

  for (const [key, schema] of Object.entries(input.shape)) {
    if (!argSet.has(key)) declareOption(cmd, key, schema)
  }
}

function declareArgument(
  cmd: CommanderCommand,
  key: string,
  schema: z.ZodType,
) {
  const description = schema.description ?? ""
  const required = !isOptional(schema)
  cmd.argument(required ? `<${key}>` : `[${key}]`, description)
}

function declareOption(cmd: CommanderCommand, key: string, schema: z.ZodType) {
  const description = schema.description ?? ""
  if (isBoolean(schema)) {
    cmd.option(`--${key}`, description)
  } else {
    cmd.option(`--${key} <value>`, description)
  }
}

function wireAction<I extends z.ZodObject, O extends z.ZodObject>(
  cmd: CommanderCommand,
  config: CommandConfig,
  input: I,
  output: O,
  handler: (input: z.infer<I>) => z.infer<O> | Promise<z.infer<O>>,
) {
  const argKeys = config.arguments ?? []
  cmd.action(async (...args) => {
    const positionals = args.slice(0, argKeys.length)
    const options = cmd.opts()

    const raw: Record<string, unknown> = { ...options }
    argKeys.forEach((key, i) => {
      raw[key] = positionals[i]
    })

    const parsed = input.parse(raw)
    const result = await handler(parsed)
    output.parse(result)
  })
}

function isOptional(schema: unknown) {
  return schema instanceof z.ZodOptional || schema instanceof z.ZodDefault
}

function isBoolean(schema: unknown) {
  if (schema instanceof z.ZodBoolean) return true
  if (schema instanceof z.ZodOptional || schema instanceof z.ZodDefault) {
    return isBoolean(schema.unwrap())
  }
  return false
}
