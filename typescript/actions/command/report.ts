import type { Command as CommanderCommand, Option } from "commander"
import { z } from "zod"
import { FieldArgument } from "../../models/argument.ts"
import { FieldOption } from "../../models/option.ts"

type ReportProps =
  | { mode: "json" }
  | {
      mode: "cli"
      raw: Record<string, unknown>
      fields: { argKeys: readonly string[]; optionKeys: ReadonlyMap<string, Option> }
    }

/**
 * Report a failed input parse through commander's `error()`, worded like
 * commander's own parse errors, so it prints to stderr and exits with code 1 (or
 * throws a `CommanderError` coded `fireargs.invalidInput` / `fireargs.invalidJson`
 * under `exitOverride`). Anything other than a zod or JSON failure is rethrown.
 */
export function reportInputError(
  cmd: CommanderCommand,
  error: unknown,
  props: ReportProps,
) {
  if (props.mode === "json" && error instanceof SyntaxError) {
    return cmd.error(`error: --json value is not valid JSON: ${error.message}`, {
      code: "fireargs.invalidJson",
      exitCode: 1,
    })
  }
  if (!(error instanceof z.ZodError)) throw error

  const lines =
    props.mode === "json"
      ? error.issues.map(formatJsonIssue)
      : pickFirstIssuePerKey(error.issues).map(issue => formatCliIssue(cmd, issue, props))
  return cmd.error(lines.join("\n"), { code: "fireargs.invalidInput", exitCode: 1 })
}

function pickFirstIssuePerKey(issues: readonly z.core.$ZodIssue[]) {
  const seen = new Set<PropertyKey>()
  return issues.filter(issue => {
    const key = issue.path[0]
    if (key === undefined) return true
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}

function formatJsonIssue(issue: z.core.$ZodIssue) {
  const path = z.core.toDotPath(issue.path)
  if (!path) return `error: invalid --json input: ${issue.message}`
  return `error: invalid --json input at '${path}': ${issue.message}`
}

function formatCliIssue(
  cmd: CommanderCommand,
  issue: z.core.$ZodIssue,
  props: Extract<ReportProps, { mode: "cli" }>,
) {
  const key = issue.path[0]
  if (typeof key !== "string") return `error: invalid input. ${issue.message}`

  const value = props.raw[key]
  const argIndex = props.fields.argKeys.indexOf(key)
  if (argIndex !== -1) {
    const arg = cmd.registeredArguments[argIndex]
    const name = arg?.name() ?? key
    if (value === undefined) return `error: missing required argument '${name}'`
    const tokens = arg instanceof FieldArgument ? arg.tokens : []
    const shown = formatIssueValue(value, tokens, issue)
    return `error: command-argument value '${shown}' is invalid for argument '${name}'. ${issue.message}`
  }

  const opt = props.fields.optionKeys.get(key)
  const flags = opt?.flags ?? `--${key}`
  if (value === undefined) return `error: required option '${flags}' not specified`
  const shown = formatIssueValue(
    value,
    opt instanceof FieldOption ? opt.tokens : [],
    issue,
  )
  if (opt !== undefined && cmd.getOptionValueSource(opt.attributeName()) === "env") {
    return `error: option '${flags}' value '${shown}' from env '${opt.envVar}' is invalid. ${issue.message}`
  }
  return `error: option '${flags}' argument '${shown}' is invalid. ${issue.message}`
}

// `tokens` are the strings typed, when a parser turned them into `value`
function formatIssueValue(
  value: unknown,
  tokens: readonly string[],
  issue: z.core.$ZodIssue,
) {
  const index = issue.path[1]
  const items = tokens.length > 0 ? tokens : [value].flat()
  const indexed =
    tokens.length === 0 || (Array.isArray(value) && value.length === tokens.length)
  if (indexed && Array.isArray(value) && typeof index === "number") {
    return String(items[index])
  }
  return items.map(String).join(" ")
}
