import { Command as CommanderCommand, Option } from "commander"
import { describe, expect, it } from "vite-plus/test"
import { z } from "zod"
import { reportInputError } from "./report.ts"

describe("reportInputError", () => {
  it("reports a --json value that is not JSON", () => {
    const error = readJsonError("{bad")
    expect(() => reportInputError(createCommand(), error, { mode: "json" })).toThrow(
      expect.objectContaining({
        code: "fireargs.invalidJson",
        message: expect.stringMatching(/^error: --json value is not valid JSON: /),
      }),
    )
  })

  it("rethrows an error that is not an input failure", () => {
    const error = new Error("boom")
    expect(() => reportInputError(createCommand(), error, { mode: "json" })).toThrow(
      error,
    )
  })

  it("words a missing and an invalid positional like commander, by its CLI name", () => {
    const cmd = createCommand()
    const fields = declareFields(cmd, { filePath: "<file-path>" })
    const error = readError(z.object({ filePath: z.string() }), {})
    expect(() => reportInputError(cmd, error, { mode: "cli", raw: {}, fields })).toThrow(
      "error: missing required argument 'file-path'",
    )

    const raw = { filePath: "big" }
    const invalid = readError(z.object({ filePath: z.coerce.number() }), raw)
    expect(() => reportInputError(cmd, invalid, { mode: "cli", raw, fields })).toThrow(
      "error: command-argument value 'big' is invalid for argument 'file-path'. " +
        "Invalid input: expected number, received NaN",
    )
  })

  it("shows the offending element of a variadic positional", () => {
    const cmd = createCommand()
    const fields = declareFields(cmd, { sizes: "<sizes...>" })
    const raw = { sizes: ["1", "big"] }
    const error = readError(z.object({ sizes: z.array(z.coerce.number()) }), raw)
    expect(() => reportInputError(cmd, error, { mode: "cli", raw, fields })).toThrow(
      "error: command-argument value 'big' is invalid for argument 'sizes'.",
    )
  })

  it("names options by their declared flags", () => {
    const cmd = createCommand()
    const fields = declareFields(
      cmd,
      {},
      { name: "-n, --name <value>", headerRows: "--header-rows <value>" },
    )
    const schema = z.object({ name: z.string(), headerRows: z.coerce.number() })
    const raw = { headerRows: "x" }

    expect(() =>
      reportInputError(cmd, readError(schema, raw), { mode: "cli", raw, fields }),
    ).toThrow(
      "error: required option '-n, --name <value>' not specified\n" +
        "error: option '--header-rows <value>' argument 'x' is invalid. " +
        "Invalid input: expected number, received NaN",
    )
  })

  it("reports one line per key and keeps root issues", () => {
    const cmd = createCommand()
    const fields = declareFields(cmd, { name: "<name>" })
    const schema = z
      .object({ name: z.string().min(3).regex(/^a/) })
      .refine(() => false, "Rejected")
    const raw = { name: "b" }

    expect(() =>
      reportInputError(cmd, readError(schema, raw), { mode: "cli", raw, fields }),
    ).toThrow(
      "error: command-argument value 'b' is invalid for argument 'name'. " +
        "Too small: expected string to have >=3 characters\n" +
        "error: invalid input. Rejected",
    )
  })

  it("reports every --json issue at its dotted path", () => {
    const schema = z.object({ a: z.object({ b: z.array(z.number()) }), c: z.string() })
    const error = readError(schema, { a: { b: ["x"] } })

    expect(() => reportInputError(createCommand(), error, { mode: "json" })).toThrow(
      "error: invalid --json input at 'a.b[0]': Invalid input: expected number, received string\n" +
        "error: invalid --json input at 'c': Invalid input: expected string, received undefined",
    )
    expect(() =>
      reportInputError(createCommand(), readError(schema, 1), { mode: "json" }),
    ).toThrow(
      "error: invalid --json input: Invalid input: expected object, received number",
    )
  })

  it("exits through commander with the fireargs.invalidInput code", () => {
    let stderr = ""
    const cmd = createCommand()
    cmd.configureOutput({ writeErr: str => (stderr += str) })
    const error = readError(z.object({ c: z.string() }), {})

    expect(() => reportInputError(cmd, error, { mode: "json" })).toThrow(
      expect.objectContaining({ code: "fireargs.invalidInput", exitCode: 1 }),
    )
    expect(stderr).toContain("error: invalid --json input at 'c'")
  })
})

function createCommand() {
  const cmd = new CommanderCommand("test")
  cmd.exitOverride()
  cmd.configureOutput({ writeErr: () => {} })
  return cmd
}

function declareFields(
  cmd: CommanderCommand,
  args: Record<string, string>,
  options: Record<string, string> = {},
) {
  for (const spec of Object.values(args)) cmd.argument(spec)
  const optionKeys = new Map<string, Option>()
  for (const [key, flags] of Object.entries(options)) {
    const opt = new Option(flags)
    cmd.addOption(opt)
    optionKeys.set(key, opt)
  }
  return { argKeys: Object.keys(args), optionKeys }
}

function readError(schema: z.ZodType, value: unknown) {
  return schema.safeParse(value).error
}

function readJsonError(value: string) {
  try {
    JSON.parse(value)
    return undefined
  } catch (error) {
    return error
  }
}
