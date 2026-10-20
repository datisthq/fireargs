import {
  Command as CommanderCommand,
  InvalidArgumentError,
  Option,
  type AddHelpTextPosition,
} from "commander"
import { z } from "zod"
import { FieldArgument } from "../../models/argument.ts"
import type { ArgumentConfig } from "../../models/argument-config.ts"
import { Command } from "../../models/command.ts"
import type { CommandConfig } from "../../models/config.ts"
import type { CommandContext, RenderContext } from "../../models/context.ts"
import type { OptionConfig } from "../../models/option-config.ts"
import { findErrorHandler, handleError, registerErrorHandler } from "../error/handle.ts"
import { readFieldMeta } from "../field/read.ts"
import {
  buildLeafTool,
  buildHelpTool,
  readManifestBuilder,
  registerManifestBuilder,
} from "./manifest.ts"
import { reportInputError } from "./report.ts"

/**
 * Build a fully-wired `Command` from the fireargs builder state.
 * Applies config pass-throughs, declares arguments and options derived from
 * the input zod schema (with each field's `createArgument`/`createOption`
 * metadata selecting positional vs flag and supplying per-field config), and
 * wires the `.action(...)` callback to validate input via zod, invoke the
 * handler, validate the return value via the output schema, and then write it
 * as JSON or hand it to `render`.
 */
export function compileCommand<I extends z.ZodObject, O extends z.ZodType>(
  config: CommandConfig,
  input: I,
  output: O,
  handler: Handler<I, O>,
  render?: Render<I, O>,
) {
  const cmd = new Command(config.name)
  applyConfig(cmd, config)
  const fields = declareFields(cmd, input)
  wireAction(cmd, fields, input, output, handler, render)
  if (config.renderError !== undefined) registerErrorHandler(cmd, config.renderError)
  registerManifestBuilder(cmd, prefix => [buildLeafTool(cmd, input, output, prefix)])
  return cmd
}

export type Handler<I extends z.ZodObject, O extends z.ZodType> = (
  input: z.infer<I>,
  ctx: CommandContext,
) => z.infer<O> | Promise<z.infer<O>>

export type Render<I extends z.ZodObject, O extends z.ZodType> = (
  output: z.output<O>,
  ctx: RenderContext<z.output<I>>,
) => string | void | Promise<string | void>

function applyConfig(cmd: CommanderCommand, config: CommandConfig) {
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

  if (config.configureHelp !== undefined) cmd.configureHelp(config.configureHelp)

  if (config.addHelpText !== undefined) {
    const positions: AddHelpTextPosition[] = ["beforeAll", "before", "after", "afterAll"]
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

  if (config.jsonOption !== false) {
    const flags = config.jsonOption?.flags ?? "--json [value]"
    const description =
      config.jsonOption?.description ??
      "write output as JSON; pass a JSON string to also drive input"
    const option = new Option(flags, description)
    cmd.addOption(option)
    cmd.on(`option:${option.name()}`, (value: unknown) => {
      if (typeof value === "string") relaxArguments(cmd)
    })
  }

  if (config.llmsOption !== false) {
    const flags = config.llmsOption?.flags ?? "--llms"
    const description =
      config.llmsOption?.description ??
      "print this command's schema (name, input, output) as JSON for LLM tool-use"
    const option = new Option(flags, description)
    cmd.addOption(option)
    cmd.on(`option:${option.name()}`, () => relaxArguments(cmd))
  }
}

// `option:*` events fire while options are parsed, before commander checks for
// missing positionals; `Command.restoreStateBeforeParse` undoes this next parse
function relaxArguments(cmd: CommanderCommand) {
  for (const arg of cmd.registeredArguments) arg.required = false
}

function declareFields(cmd: CommanderCommand, input: z.ZodObject) {
  const argKeys: string[] = []
  for (const [key, schema] of Object.entries(input.shape)) {
    const meta = readFieldMeta(schema)
    if (meta?.kind === "argument") argKeys.push(key)
  }

  for (const key of argKeys) {
    const schema = input.shape[key]
    if (schema === undefined) continue
    const meta = readFieldMeta(schema)
    declareArgument(cmd, key, schema, meta?.kind === "argument" ? meta : undefined)
  }

  const optionKeys = new Map<string, Option>()
  const optionMetas = new Map<string, OptionConfig>()
  for (const [key, schema] of Object.entries(input.shape)) {
    const meta = readFieldMeta(schema)
    if (meta?.kind === "argument") continue
    const optionMeta = meta?.kind === "option" ? meta : undefined
    optionKeys.set(key, declareOption(cmd, key, schema, optionMeta))
    if (optionMeta !== undefined) optionMetas.set(key, optionMeta)
  }
  applyOptionRelations(optionKeys, optionMetas)

  return { argKeys, optionKeys }
}

function deriveCliName(key: string, name: string | undefined) {
  if (name !== undefined) return name
  return key
    .replace(/([a-z0-9])([A-Z])/g, "$1-$2")
    .replace(/([A-Z])([A-Z][a-z])/g, "$1-$2")
    .toLowerCase()
}

function declareArgument(
  cmd: CommanderCommand,
  key: string,
  schema: z.ZodType,
  meta: ArgumentConfig | undefined,
) {
  const description = schema.description ?? ""
  const dflt = getDefault(schema)
  const inner = unwrap(schema)
  const { variadic, choices } = readValueShape(inner, meta?.parse)

  const name = `${deriveCliName(key, meta?.name)}${variadic ? "..." : ""}`
  const required = !schema.safeParse(undefined).success
  const arg = new FieldArgument(required ? `<${name}>` : `[${name}]`, description)
  if (choices !== undefined) arg.choices(choices)
  if (dflt !== undefined) arg.default(dflt, meta?.defaultDescription)
  const parser = createValueParser(inner, meta?.parse, dflt)
  if (parser !== undefined) arg.argParser(parser)
  cmd.addArgument(arg)
}

function declareOption(
  cmd: CommanderCommand,
  key: string,
  schema: z.ZodType,
  meta: OptionConfig | undefined,
) {
  const description = schema.description ?? ""
  const dflt = getDefault(schema)
  const inner = unwrap(schema)
  const shortPrefix = meta?.short ? `-${meta.short}, ` : ""
  const long = `--${deriveCliName(key, meta?.name)}`

  if (inner instanceof z.ZodBoolean && meta?.parse === undefined) {
    return addOption(cmd, new Option(`${shortPrefix}${long}`, description), dflt, meta)
  }

  const { variadic, choices } = readValueShape(inner, meta?.parse)
  const suffix = variadic ? "..." : ""
  const opt = new Option(`${shortPrefix}${long} <value${suffix}>`, description)
  if (choices !== undefined) opt.choices(choices)
  const parser = createValueParser(inner, meta?.parse, dflt)
  if (parser !== undefined) opt.argParser(parser)
  return addOption(cmd, opt, dflt, meta)
}

function addOption(
  cmd: CommanderCommand,
  opt: Option,
  dflt: unknown,
  meta: OptionConfig | undefined,
) {
  // A `--no-` flag would otherwise become a negation: inverted value, defaulting to true
  opt.negate = false
  if (dflt !== undefined) opt.default(dflt, meta?.defaultDescription)
  applyOptionMeta(opt, meta)
  cmd.addOption(opt)
  return opt
}

function applyOptionRelations(
  optionKeys: ReadonlyMap<string, Option>,
  optionMetas: ReadonlyMap<string, OptionConfig>,
) {
  const readAttribute = (key: string) => optionKeys.get(key)?.attributeName() ?? key
  for (const [key, meta] of optionMetas) {
    const opt = optionKeys.get(key)
    if (opt === undefined) continue
    if (meta.conflicts !== undefined) {
      opt.conflicts([meta.conflicts].flat().map(readAttribute))
    }
    if (meta.implies !== undefined) {
      const entries = Object.entries(meta.implies)
      opt.implies(Object.fromEntries(entries.map(([k, v]) => [readAttribute(k), v])))
    }
  }
}

// A field with `parse` takes one token: commander's own variadic collecting and its
// choices (an argParser too) would otherwise run before, or instead of, `parse`.
function readValueShape(inner: unknown, parse: ((value: string) => unknown) | undefined) {
  let variadic = false
  let choices: readonly string[] | undefined
  if (parse !== undefined) return { variadic, choices }
  if (inner instanceof z.ZodArray) {
    variadic = true
    const element = unwrap(inner.element)
    if (element instanceof z.ZodEnum) choices = stringChoices(element.options)
  } else if (inner instanceof z.ZodEnum) {
    choices = stringChoices(inner.options)
  }
  return { variadic, choices }
}

function createValueParser(
  inner: unknown,
  parse: ((value: string) => unknown) | undefined,
  dflt: unknown,
) {
  if (parse !== undefined) return (value: string) => runParse(parse, value)
  if (inner instanceof z.ZodNumber) return parseNumber
  if (inner instanceof z.ZodArray && unwrap(inner.element) instanceof z.ZodNumber) {
    return (value: string, previous: unknown) => {
      // Mirrors commander's `_collectValue`: a repeated value replaces the default.
      const values = previous === dflt || !Array.isArray(previous) ? [] : previous
      return [...values, parseNumber(value)]
    }
  }
  return undefined
}

function runParse(parse: (value: string) => unknown, value: string) {
  try {
    return parse(value)
  } catch (error) {
    throw new InvalidArgumentError(error instanceof Error ? error.message : String(error))
  }
}

function parseNumber(value: string) {
  const number = value.trim() === "" ? Number.NaN : Number(value)
  if (Number.isNaN(number)) throw new InvalidArgumentError("Not a number.")
  return number
}

function applyOptionMeta(opt: Option, meta: OptionConfig | undefined) {
  if (meta === undefined) return
  if (meta.env !== undefined) opt.env(meta.env)
  if (meta.hidden) opt.hideHelp(true)
  if (meta.preset !== undefined) opt.preset(meta.preset)
  if (meta.helpGroup !== undefined) opt.helpGroup(meta.helpGroup)
}

function wireAction<I extends z.ZodObject, O extends z.ZodType>(
  cmd: Command,
  fields: { argKeys: readonly string[]; optionKeys: ReadonlyMap<string, Option> },
  input: I,
  output: O,
  handler: Handler<I, O>,
  render: Render<I, O> | undefined,
) {
  cmd.action(async (...args) => {
    const options = cmd.opts()
    const json = options.json
    const writer = cmd.configureOutput().writeOut ?? (s => process.stdout.write(s))

    if (options.llms === true) {
      const tools = readManifestBuilder(cmd, "") ?? []
      const manifest = { tools: [buildHelpTool(), ...tools] }
      writer(`${JSON.stringify(manifest, null, 2)}\n`)
      return
    }

    const ctx: CommandContext = { json: json !== undefined, command: cmd }
    let parsed: z.output<I>
    try {
      parsed = input.parse(
        typeof json === "string" ? JSON.parse(json) : buildRawFromCli(),
      )
    } catch (error) {
      // Without a renderError hook, input failures read like commander's own parse errors
      if (findErrorHandler(cmd) === undefined) {
        if (typeof json === "string")
          return reportInputError(cmd, error, { mode: "json" })
        const raw = buildRawFromCli()
        return reportInputError(cmd, error, { mode: "cli", raw, fields })
      }
      return handleError(cmd, error, ctx)
    }

    try {
      const validated = output.parse(await handler(parsed, ctx))

      if (ctx.json) {
        writer(`${JSON.stringify(validated ?? null, null, 2)}
`)
        return
      }

      const rendered = await render?.(validated, { ...ctx, input: parsed })
      if (typeof rendered === "string")
        writer(`${rendered}
`)
    } catch (error) {
      await handleError(cmd, error, ctx)
    }

    function buildRawFromCli() {
      const positionals = args.slice(0, fields.argKeys.length)
      const raw: Record<string, unknown> = {}
      for (const [key, opt] of fields.optionKeys) {
        const value = options[opt.attributeName()]
        if (value !== undefined) raw[key] = value
      }
      fields.argKeys.forEach((key, i) => {
        raw[key] = positionals[i]
      })
      return raw
    }
  })
}

function stringChoices(options: readonly unknown[]) {
  return options.filter((o): o is string => typeof o === "string")
}

function unwrap(schema: unknown) {
  let s = schema
  while (
    s instanceof z.ZodOptional ||
    s instanceof z.ZodDefault ||
    s instanceof z.ZodNullable
  ) {
    s = s.unwrap()
  }
  return s
}

function getDefault(schema: unknown) {
  let s = schema
  while (s instanceof z.ZodOptional || s instanceof z.ZodNullable) {
    s = s.unwrap()
  }
  if (s instanceof z.ZodDefault) {
    const dv = s._def.defaultValue
    return typeof dv === "function" ? dv() : dv
  }
  return undefined
}
