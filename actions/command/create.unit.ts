import { Command as CommanderCommand } from "commander"
import { afterEach, describe, expect, expectTypeOf, it } from "vite-plus/test"
import { z } from "zod"
import { f, type Command, type CommandContext, type RenderContext } from "../../index.ts"
import { readFieldMeta } from "../field/read.ts"

describe("f.command", () => {
  it("returns a Command instance", () => {
    const cmd = f
      .command({ name: "greet" })
      .input(z.object({}))
      .output(z.object({}))
      .handler(() => ({}))

    expectTypeOf(cmd).toEqualTypeOf<Command>()
    expect(cmd).toBeInstanceOf(CommanderCommand)
    expect(cmd.type).toBe("command")
    expect(cmd.name()).toBe("greet")
  })

  it("applies identity config to the commander Command", () => {
    const cmd = f
      .command({
        name: "greet",
        description: "Greet someone",
        summary: "greet",
        aliases: ["hi"],
        version: "1.0.0",
      })
      .input(z.object({}))
      .output(z.object({}))
      .handler(() => ({}))

    expect(cmd.name()).toBe("greet")
    expect(cmd.description()).toBe("Greet someone")
    expect(cmd.summary()).toBe("greet")
    expect(cmd.aliases()).toEqual(["hi"])
  })

  it("declares positional arguments via f.argument", async () => {
    let captured: unknown
    const cmd = f
      .command({ name: "greet" })
      .input(z.object({ name: f.argument().string() }))
      .output(z.object({ ok: z.boolean() }))
      .handler(input => {
        captured = input
        return { ok: true }
      })

    await cmd.parseAsync(["world"], { from: "user" })
    expect(captured).toEqual({ name: "world" })
  })

  it("treats bare zod fields as --options and coerces via zod", async () => {
    let captured: unknown
    const cmd = f
      .command({ name: "greet" })
      .input(z.object({ count: z.coerce.number() }))
      .output(z.object({ ok: z.boolean() }))
      .handler(input => {
        captured = input
        return { ok: true }
      })

    await cmd.parseAsync(["--count", "5"], { from: "user" })
    expect(captured).toEqual({ count: 5 })
  })

  it("declares boolean fields as value-less flags", async () => {
    let captured: unknown
    const cmd = f
      .command({ name: "greet" })
      .input(z.object({ verbose: z.boolean() }))
      .output(z.object({ ok: z.boolean() }))
      .handler(input => {
        captured = input
        return { ok: true }
      })

    await cmd.parseAsync(["--verbose"], { from: "user" })
    expect(captured).toEqual({ verbose: true })
  })

  it("treats optional positional arguments as `[key]`", async () => {
    let captured: unknown
    const cmd = f
      .command({ name: "greet" })
      .input(z.object({ name: f.argument().schema(z.string().optional()) }))
      .output(z.object({ ok: z.boolean() }))
      .handler(input => {
        captured = input
        return { ok: true }
      })

    await cmd.parseAsync([], { from: "user" })
    expect(captured).toEqual({})
  })

  it("invokes hooks", async () => {
    let preCalled = false
    let postCalled = false
    const cmd = f
      .command({
        name: "greet",
        preAction: () => {
          preCalled = true
        },
        postAction: () => {
          postCalled = true
        },
      })
      .input(z.object({}))
      .output(z.object({}))
      .handler(() => ({}))

    await cmd.parseAsync([], { from: "user" })
    expect(preCalled).toBe(true)
    expect(postCalled).toBe(true)
  })

  it("derives choices from z.enum on options", async () => {
    let captured: unknown
    const cmd = f
      .command({
        name: "greet",
        exitOverride: true,
        configureOutput: { writeErr: () => {} },
      })
      .input(z.object({ kind: z.enum(["a", "b", "c"]) }))
      .output(z.object({ ok: z.boolean() }))
      .handler(input => {
        captured = input
        return { ok: true }
      })

    await cmd.parseAsync(["--kind", "b"], { from: "user" })
    expect(captured).toEqual({ kind: "b" })
    await expect(cmd.parseAsync(["--kind", "z"], { from: "user" })).rejects.toThrow()
  })

  it("derives choices from z.enum on positionals built via f.argument", async () => {
    let captured: unknown
    const cmd = f
      .command({ name: "greet" })
      .input(z.object({ kind: f.argument().enum(["a", "b"]) }))
      .output(z.object({ ok: z.boolean() }))
      .handler(input => {
        captured = input
        return { ok: true }
      })

    await cmd.parseAsync(["a"], { from: "user" })
    expect(captured).toEqual({ kind: "a" })
  })

  it("forwards z.default values to commander", async () => {
    let captured: unknown
    const cmd = f
      .command({ name: "greet" })
      .input(z.object({ port: z.coerce.number().default(8080) }))
      .output(z.object({ ok: z.boolean() }))
      .handler(input => {
        captured = input
        return { ok: true }
      })

    await cmd.parseAsync([], { from: "user" })
    expect(captured).toEqual({ port: 8080 })
  })

  it("treats z.array option fields as variadic", async () => {
    let captured: unknown
    const cmd = f
      .command({ name: "greet" })
      .input(z.object({ files: z.array(z.string()) }))
      .output(z.object({ ok: z.boolean() }))
      .handler(input => {
        captured = input
        return { ok: true }
      })

    await cmd.parseAsync(["--files", "a", "b", "c"], { from: "user" })
    expect(captured).toEqual({ files: ["a", "b", "c"] })
  })

  it("treats variadic positionals built via f.argument as `<key...>`", async () => {
    let captured: unknown
    const cmd = f
      .command({ name: "greet" })
      .input(z.object({ files: f.argument().array(z.string()) }))
      .output(z.object({ ok: z.boolean() }))
      .handler(input => {
        captured = input
        return { ok: true }
      })

    await cmd.parseAsync(["a", "b"], { from: "user" })
    expect(captured).toEqual({ files: ["a", "b"] })
  })

  it("marks options without default or .optional as mandatory", async () => {
    const cmd = f
      .command({
        name: "greet",
        exitOverride: true,
        configureOutput: { writeErr: () => {} },
      })
      .input(z.object({ name: z.string() }))
      .output(z.object({ ok: z.boolean() }))
      .handler(() => ({ ok: true }))

    await expect(cmd.parseAsync([], { from: "user" })).rejects.toMatchObject({
      code: "fireargs.invalidInput",
      exitCode: 1,
      message: "error: required option '--name <value>' not specified",
    })
  })

  it("reports zod validation errors from input like commander", async () => {
    let stderr = ""
    let called = false
    const cmd = f
      .command({
        name: "greet",
        exitOverride: true,
        configureOutput: { writeErr: str => (stderr += str) },
      })
      .input(z.object({ count: z.coerce.number().min(10) }))
      .output(z.object({ ok: z.boolean() }))
      .handler(() => {
        called = true
        return { ok: true }
      })

    const message =
      "error: option '--count <value>' argument '3' is invalid. " +
      "Too small: expected number to be >=10"
    await expect(
      cmd.parseAsync(["--count", "3"], { from: "user" }),
    ).rejects.toMatchObject({ code: "fireargs.invalidInput", exitCode: 1, message })
    expect(stderr).toBe(`${message}\n`)
    expect(called).toBe(false)
  })

  it("f.option attaches short flag", async () => {
    let captured: unknown
    const cmd = f
      .command({ name: "greet" })
      .input(
        z.object({
          verbose: f.option({ short: "v" }).boolean(),
        }),
      )
      .output(z.object({ ok: z.boolean() }))
      .handler(input => {
        captured = input
        return { ok: true }
      })

    await cmd.parseAsync(["-v"], { from: "user" })
    expect(captured).toEqual({ verbose: true })
  })

  it("f.option attaches env binding", async () => {
    let captured: unknown
    const cmd = f
      .command({ name: "greet" })
      .input(
        z.object({
          port: f.option({ env: "FIREARGS_TEST_PORT" }).schema(z.coerce.number()),
        }),
      )
      .output(z.object({ ok: z.boolean() }))
      .handler(input => {
        captured = input
        return { ok: true }
      })

    process.env.FIREARGS_TEST_PORT = "9090"
    try {
      await cmd.parseAsync([], { from: "user" })
      expect(captured).toEqual({ port: 9090 })
    } finally {
      delete process.env.FIREARGS_TEST_PORT
    }
  })

  it("f.option attaches conflicts", async () => {
    const cmd = f
      .command({
        name: "greet",
        exitOverride: true,
        configureOutput: { writeErr: () => {} },
      })
      .input(
        z.object({
          rgb: f.option({ conflicts: "cmyk" }).boolean(),
          cmyk: z.boolean(),
        }),
      )
      .output(z.object({ ok: z.boolean() }))
      .handler(() => ({ ok: true }))

    await expect(cmd.parseAsync(["--rgb", "--cmyk"], { from: "user" })).rejects.toThrow()
  })

  it("f.option attaches hidden flag", () => {
    const cmd = f
      .command({ name: "greet" })
      .input(
        z.object({
          secret: f.option({ hidden: true }).string(),
        }),
      )
      .output(z.object({ ok: z.boolean() }))
      .handler(() => ({ ok: true }))

    expect(cmd.helpInformation()).not.toContain("--secret")
  })

  it("rejects non-object schemas at .input", () => {
    f.command().input(
      // @ts-expect-error string is not a ZodObject
      z.string(),
    )
  })

  it("accepts non-object schemas at .output", async () => {
    let captured = ""
    const cmd = f
      .command({
        name: "list",
        configureOutput: {
          writeOut: str => {
            captured += str
          },
        },
      })
      .input(z.object({}))
      .output(z.array(z.string()))
      .handler(() => ["a", "b"])

    await cmd.parseAsync(["--json"], { from: "user" })
    expect(JSON.parse(captured)).toEqual(["a", "b"])

    captured = ""
    await cmd.parseAsync(["--llms"], { from: "user" })
    const manifest = JSON.parse(captured)
    expect(manifest.tools[1].outputSchema.type).toBe("array")
  })

  it("--json writes null for an undefined output", async () => {
    let captured = ""
    const cmd = f
      .command({
        name: "noop",
        configureOutput: {
          writeOut: str => {
            captured += str
          },
        },
      })
      .input(z.object({}))
      .output(z.undefined())
      .handler(() => undefined)

    await cmd.parseAsync(["--json"], { from: "user" })
    expect(captured).toBe("null\n")
  })

  it("rejects mismatched handler return type", () => {
    f.command()
      .input(z.object({}))
      .output(z.object({ id: z.number() }))
      .handler(
        // @ts-expect-error id must be a number
        () => ({ id: "x" }),
      )
  })

  it("forwards addHelpText paragraphs to commander", () => {
    let captured = ""
    const cmd = f
      .command({
        name: "greet",
        addHelpText: { after: "extra footer text" },
        configureOutput: {
          writeOut: str => {
            captured += str
          },
        },
      })
      .input(z.object({}))
      .output(z.object({}))
      .handler(() => ({}))

    cmd.outputHelp()
    expect(captured).toContain("extra footer text")
  })

  it("exitOverride: true makes commander throw instead of exit", async () => {
    const cmd = f
      .command({
        name: "greet",
        exitOverride: true,
        configureOutput: { writeErr: () => {} },
      })
      .input(z.object({ name: z.string() }))
      .output(z.object({}))
      .handler(() => ({}))

    await expect(cmd.parseAsync([], { from: "user" })).rejects.toThrow()
  })

  it("registers `on` event listeners", async () => {
    let received: unknown
    const cmd = f
      .command({
        name: "greet",
        on: [
          {
            event: "option:port",
            listener: (...args) => {
              received = args[0]
            },
          },
        ],
      })
      .input(z.object({ port: z.coerce.number() }))
      .output(z.object({}))
      .handler(() => ({}))

    await cmd.parseAsync(["--port", "42"], { from: "user" })
    expect(received).toBe("42")
  })

  it("forwards executableDir to commander", () => {
    const cmd = f
      .command({ name: "greet", executableDir: "/some/path" })
      .input(z.object({}))
      .output(z.object({}))
      .handler(() => ({}))

    expect(cmd.executableDir()).toBe("/some/path")
  })

  it("exposes --json by default", () => {
    const cmd = f
      .command({ name: "greet" })
      .input(z.object({}))
      .output(z.object({}))
      .handler(() => ({}))

    expect(cmd.helpInformation()).toContain("--json")
  })

  it("--json <value> drives input and writes output JSON", async () => {
    let captured = ""
    const cmd = f
      .command({
        name: "greet",
        configureOutput: {
          writeOut: str => {
            captured += str
          },
        },
      })
      .input(z.object({ name: z.string() }))
      .output(z.object({ greeting: z.string() }))
      .handler(input => ({ greeting: `hello ${input.name}` }))

    await cmd.parseAsync(["--json", '{"name":"world"}'], { from: "user" })
    expect(JSON.parse(captured)).toEqual({ greeting: "hello world" })
  })

  it("--json without value still uses CLI inputs and writes JSON output", async () => {
    let captured = ""
    const cmd = f
      .command({
        name: "greet",
        configureOutput: {
          writeOut: str => {
            captured += str
          },
        },
      })
      .input(z.object({ name: f.argument().string() }))
      .output(z.object({ greeting: z.string() }))
      .handler(input => ({ greeting: `hello ${input.name}` }))

    await cmd.parseAsync(["world", "--json"], { from: "user" })
    expect(JSON.parse(captured)).toEqual({ greeting: "hello world" })
  })

  it("--json mode rejects input invalid for the schema", async () => {
    const cmd = f
      .command({
        name: "greet",
        exitOverride: true,
        configureOutput: { writeErr: () => {} },
      })
      .input(z.object({ count: z.number() }))
      .output(z.object({}))
      .handler(() => ({}))

    await expect(
      cmd.parseAsync(["--json", '{"count":"not-a-number"}'], { from: "user" }),
    ).rejects.toMatchObject({
      code: "fireargs.invalidInput",
      message:
        "error: invalid --json input at 'count': Invalid input: expected number, received string",
    })
  })

  it("--json mode rejects a value that is not JSON", async () => {
    const cmd = f
      .command({
        name: "greet",
        exitOverride: true,
        configureOutput: { writeErr: () => {} },
      })
      .input(z.object({}))
      .output(z.object({}))
      .handler(() => ({}))

    await expect(
      cmd.parseAsync(["--json", "{not json"], { from: "user" }),
    ).rejects.toMatchObject({ code: "fireargs.invalidJson", exitCode: 1 })
  })

  it("still rejects with the ZodError when the output is invalid", async () => {
    const cmd = f
      .command({ name: "greet" })
      .input(z.object({}))
      .output(z.object({ ok: z.boolean() }))
      // @ts-expect-error the handler breaks its output schema on purpose
      .handler(() => ({ ok: "yes" }))

    await expect(cmd.parseAsync([], { from: "user" })).rejects.toBeInstanceOf(z.ZodError)
  })

  it("--llms prints the command manifest as JSON", async () => {
    let captured = ""
    const cmd = f
      .command({
        name: "greet",
        description: "Greet someone",
        configureOutput: {
          writeOut: str => {
            captured += str
          },
        },
      })
      .input(z.object({ name: z.string() }))
      .output(z.object({ greeting: z.string() }))
      .handler(input => ({ greeting: `hello ${input.name}` }))

    await cmd.parseAsync(["--llms"], { from: "user" })
    const manifest = JSON.parse(captured)
    expect(manifest.tools).toHaveLength(2)
    expect(manifest.tools[0].name).toBe("help")
    expect(manifest.tools[0].description).toContain("--json")
    expect(manifest.tools[1].name).toBe("greet")
    expect(manifest.tools[1].description).toBe("Greet someone")
    expect(manifest.tools[1].inputSchema.type).toBe("object")
    expect(manifest.tools[1].inputSchema.properties.name).toBeDefined()
    expect(manifest.tools[1].outputSchema.type).toBe("object")
    expect(manifest.tools[1].outputSchema.properties.greeting).toBeDefined()
  })

  it("--llms strips CLI-only fireargs metadata from the manifest", async () => {
    let captured = ""
    const cmd = f
      .command({
        name: "greet",
        configureOutput: {
          writeOut: str => {
            captured += str
          },
        },
      })
      .input(
        z.object({
          name: f.argument().string().describe("user's name"),
          verbose: f.option({ short: "v", env: "VERBOSE" }).boolean(),
          times: z.number().default(1),
          kind: z.enum(["a", "b"]),
        }),
      )
      .output(z.object({}))
      .handler(() => ({}))

    await cmd.parseAsync(["--llms"], { from: "user" })
    const manifest = JSON.parse(captured)
    const props = manifest.tools[1].inputSchema.properties
    expect(props.name.fireargs).toBeUndefined()
    expect(props.verbose.fireargs).toBeUndefined()
    expect(props.name.description).toBe("user's name")
    expect(props.times.default).toBe(1)
    expect(props.kind.enum).toEqual(["a", "b"])
  })

  it("--llms exposes the option in help", () => {
    const cmd = f
      .command({ name: "greet" })
      .input(z.object({}))
      .output(z.object({}))
      .handler(() => ({}))

    expect(cmd.helpInformation()).toContain("--llms")
  })

  it("llmsOption: false suppresses --llms", () => {
    const cmd = f
      .command({ name: "greet", llmsOption: false })
      .input(z.object({}))
      .output(z.object({}))
      .handler(() => ({}))

    expect(cmd.helpInformation()).not.toContain("--llms")
  })

  it("jsonOption: false suppresses --json", () => {
    const cmd = f
      .command({
        name: "greet",
        jsonOption: false,
        exitOverride: true,
        configureOutput: { writeErr: () => {} },
      })
      .input(z.object({}))
      .output(z.object({}))
      .handler(() => ({}))

    expect(cmd.helpInformation()).not.toContain("--json")
  })

  it("declares required positionals as `<key>` and optional ones as `[key]`", () => {
    const cmd = f
      .command({ name: "copy" })
      .input(
        z.object({
          source: f.argument().string(),
          target: f.argument().schema(z.string().optional()),
          mode: f.argument().schema(z.string().default("fast")),
        }),
      )
      .output(z.object({}))
      .handler(() => ({}))

    expect(cmd.usage()).toBe("[options] <source> [target] [mode]")
  })

  it("declares variadic positionals as `<key...>` unless defaulted", () => {
    const required = f
      .command({ name: "lint" })
      .input(z.object({ files: f.argument().array(z.string()) }))
      .output(z.object({}))
      .handler(() => ({}))
    const defaulted = f
      .command({ name: "lint" })
      .input(z.object({ files: f.argument().schema(z.array(z.string()).default([])) }))
      .output(z.object({}))
      .handler(() => ({}))

    expect(required.usage()).toBe("[options] <files...>")
    expect(defaulted.usage()).toBe("[options] [files...]")
  })

  it("reports a missing required positional like commander", async () => {
    let stderr = ""
    let called = false
    const cmd = f
      .command({
        name: "greet",
        exitOverride: true,
        configureOutput: { writeErr: str => (stderr += str) },
      })
      .input(z.object({ name: f.argument().string() }))
      .output(z.object({}))
      .handler(() => {
        called = true
        return {}
      })

    await expect(cmd.parseAsync([], { from: "user" })).rejects.toMatchObject({
      code: "commander.missingArgument",
      message: "error: missing required argument 'name'",
    })
    expect(stderr).toBe("error: missing required argument 'name'\n")
    expect(called).toBe(false)
  })

  it("reports a missing required variadic positional like commander", async () => {
    const cmd = f
      .command({
        name: "lint",
        exitOverride: true,
        configureOutput: { writeErr: () => {} },
      })
      .input(z.object({ files: f.argument().array(z.string()) }))
      .output(z.object({}))
      .handler(() => ({}))

    await expect(cmd.parseAsync([], { from: "user" })).rejects.toMatchObject({
      code: "commander.missingArgument",
      message: "error: missing required argument 'files'",
    })
  })

  it("--json <value> supplies required positionals", async () => {
    let captured = ""
    const cmd = f
      .command({
        name: "greet",
        configureOutput: { writeOut: str => (captured += str) },
      })
      .input(z.object({ name: f.argument().string() }))
      .output(z.object({ greeting: z.string() }))
      .handler(input => ({ greeting: `hello ${input.name}` }))

    await cmd.parseAsync(["--json", '{"name":"world"}'], { from: "user" })
    expect(JSON.parse(captured)).toEqual({ greeting: "hello world" })
  })

  it("--llms needs no required positionals", async () => {
    let captured = ""
    const cmd = f
      .command({
        name: "greet",
        configureOutput: { writeOut: str => (captured += str) },
      })
      .input(z.object({ name: f.argument().string() }))
      .output(z.object({}))
      .handler(() => ({}))

    await cmd.parseAsync(["--llms"], { from: "user" })
    expect(JSON.parse(captured).tools[1].name).toBe("greet")
  })

  it("bare --json still requires positionals from the CLI", async () => {
    const cmd = f
      .command({
        name: "greet",
        exitOverride: true,
        configureOutput: { writeErr: () => {} },
      })
      .input(z.object({ name: f.argument().string() }))
      .output(z.object({}))
      .handler(() => ({}))

    await expect(cmd.parseAsync(["--json"], { from: "user" })).rejects.toMatchObject({
      code: "commander.missingArgument",
    })
  })

  it("requires positionals again on the next parse after --json <value>", async () => {
    const cmd = f
      .command({
        name: "greet",
        exitOverride: true,
        configureOutput: { writeOut: () => {}, writeErr: () => {} },
      })
      .input(z.object({ name: f.argument().string() }))
      .output(z.object({}))
      .handler(() => ({}))

    await cmd.parseAsync(["--json", '{"name":"world"}'], { from: "user" })
    await expect(cmd.parseAsync([], { from: "user" })).rejects.toMatchObject({
      code: "commander.missingArgument",
    })
    await cmd.parseAsync(["--json", '{"name":"world"}'], { from: "user" })
  })

  it("requires .input before .output", () => {
    const builder = f.command()
    expectTypeOf(builder).toHaveProperty("input")
    expectTypeOf(builder).not.toHaveProperty("output")
    expectTypeOf(builder).not.toHaveProperty("handler")
  })

  it("requires .output before .handler", () => {
    const builder = f.command().input(z.object({}))
    expectTypeOf(builder).toHaveProperty("output")
    expectTypeOf(builder).not.toHaveProperty("handler")
  })

  it("allows .render once, between .output and .handler", () => {
    const builder = f.command().input(z.object({})).output(z.object({}))
    expectTypeOf(builder).toHaveProperty("render")
    expectTypeOf(builder.render(() => {})).not.toHaveProperty("render")
    expectTypeOf(builder.render(() => {})).toHaveProperty("handler")
  })

  it("types .render output and input as parsed by their schemas", () => {
    f.command()
      .input(z.object({ name: z.string().default("x") }))
      .output(z.object({ n: z.number().default(0) }))
      .render((output, ctx) => {
        expectTypeOf(output.n).toEqualTypeOf<number>()
        expectTypeOf(ctx.input.name).toEqualTypeOf<string>()
        // @ts-expect-error output has no such key
        void output.missing
      })
      .handler(() => ({ n: 1 }))
  })
})

describe("f.command flag names", () => {
  function captureInput(input: z.ZodObject) {
    const captured: { value?: unknown } = {}
    const cmd = f
      .command({
        name: "read",
        exitOverride: true,
        configureOutput: { writeErr: () => {} },
      })
      .input(input)
      .output(z.object({}))
      .handler(parsed => {
        captured.value = parsed
        return {}
      })
    return { cmd, captured }
  }

  it("derives kebab-case long flags from camelCase keys", async () => {
    const { cmd, captured } = captureInput(
      z.object({ headerRows: z.coerce.number(), HTMLParser: z.string().optional() }),
    )

    expect(cmd.helpInformation()).toContain("--header-rows <value>")
    expect(cmd.helpInformation()).toContain("--html-parser <value>")
    await cmd.parseAsync(["--header-rows", "2"], { from: "user" })
    expect(captured.value).toEqual({ headerRows: 2 })
  })

  it("rejects the verbatim camelCase flag", async () => {
    const { cmd } = captureInput(z.object({ headerRows: z.coerce.number() }))

    await expect(cmd.parseAsync(["--headerRows", "2"], { from: "user" })).rejects.toThrow(
      /unknown option/,
    )
  })

  it("reads kebab-case keys back under their own key", async () => {
    const { cmd, captured } = captureInput(z.object({ "header-rows": z.coerce.number() }))

    await cmd.parseAsync(["--header-rows", "2"], { from: "user" })
    expect(captured.value).toEqual({ "header-rows": 2 })
  })

  it("f.option name overrides the long flag", async () => {
    const { cmd, captured } = captureInput(
      z.object({
        toPath: f.option({ name: "to" }).string(),
        headerRows: f.option({ name: "headerRows" }).schema(z.coerce.number()),
      }),
    )

    expect(cmd.helpInformation()).toContain("--to <value>")
    expect(cmd.helpInformation()).not.toContain("--to-path")
    await cmd.parseAsync(["--to", "out.csv", "--headerRows", "1"], { from: "user" })
    expect(captured.value).toEqual({ toPath: "out.csv", headerRows: 1 })
  })

  it("keeps no-prefixed keys as plain flags rather than negations", async () => {
    const absent = captureInput(z.object({ noCache: z.boolean().optional() }))
    await absent.cmd.parseAsync([], { from: "user" })
    expect(absent.captured.value).toEqual({})

    const present = captureInput(z.object({ noCache: z.boolean().optional() }))
    await present.cmd.parseAsync(["--no-cache"], { from: "user" })
    expect(present.captured.value).toEqual({ noCache: true })
  })

  it("resolves conflicts and implies by input key", async () => {
    const conflicting = captureInput(
      z.object({
        toPath: f.option({ conflicts: "toStdout" }).schema(z.string().optional()),
        toStdout: f.option({ name: "stdout" }).schema(z.boolean().optional()),
      }),
    )
    await expect(
      conflicting.cmd.parseAsync(["--to-path", "x", "--stdout"], { from: "user" }),
    ).rejects.toThrow(/cannot be used with/)

    const implying = captureInput(
      z.object({
        dryRun: f.option({ implies: { skipWrite: true } }).schema(z.boolean().optional()),
        skipWrite: f.option({ name: "no-write" }).schema(z.boolean().optional()),
      }),
    )
    await implying.cmd.parseAsync(["--dry-run"], { from: "user" })
    expect(implying.captured.value).toEqual({ dryRun: true, skipWrite: true })
  })

  it("combines short, env and kebab flags", async () => {
    const { cmd, captured } = captureInput(
      z.object({
        headerRows: f
          .option({ short: "r", env: "FIREARGS_TEST_HEADER_ROWS" })
          .schema(z.coerce.number()),
      }),
    )

    expect(cmd.helpInformation()).toContain("-r, --header-rows <value>")
    process.env.FIREARGS_TEST_HEADER_ROWS = "3"
    try {
      await cmd.parseAsync([], { from: "user" })
      expect(captured.value).toEqual({ headerRows: 3 })
    } finally {
      delete process.env.FIREARGS_TEST_HEADER_ROWS
    }
  })

  it("names positionals in kebab-case and honours f.argument name", async () => {
    const { cmd, captured } = captureInput(
      z.object({
        sourcePath: f.argument().string(),
        targetPath: f.argument({ name: "target" }).string(),
      }),
    )

    expect(cmd.helpInformation()).toContain("<source-path>")
    expect(cmd.helpInformation()).toContain("<target>")
    await cmd.parseAsync(["a.csv", "b.csv"], { from: "user" })
    expect(captured.value).toEqual({ sourcePath: "a.csv", targetPath: "b.csv" })
  })

  it("names a missing kebab-case positional and option by their CLI names", async () => {
    const { cmd } = captureInput(
      z.object({
        sourcePath: f.argument().string(),
        headerRows: z.number().min(1),
      }),
    )

    await expect(cmd.parseAsync([], { from: "user" })).rejects.toMatchObject({
      message: "error: missing required argument 'source-path'",
    })
    await expect(
      cmd.parseAsync(["a.csv", "--header-rows", "0"], { from: "user" }),
    ).rejects.toMatchObject({
      code: "fireargs.invalidInput",
      message:
        "error: option '--header-rows <value>' argument '0' is invalid. " +
        "Too small: expected number to be >=1",
    })
  })

  it("--json without a value reads kebab flags", async () => {
    let written = ""
    const cmd = f
      .command({ name: "read", configureOutput: { writeOut: s => (written += s) } })
      .input(z.object({ headerRows: z.coerce.number() }))
      .output(z.object({ headerRows: z.number() }))
      .handler(input => input)

    await cmd.parseAsync(["--header-rows", "2", "--json"], { from: "user" })
    expect(JSON.parse(written)).toEqual({ headerRows: 2 })
  })

  it("--llms keeps input keys and strips name", async () => {
    let written = ""
    const cmd = f
      .command({ name: "read", configureOutput: { writeOut: s => (written += s) } })
      .input(
        z.object({
          sourcePath: f.argument({ name: "source" }).string(),
          toPath: f.option({ name: "to" }).string(),
        }),
      )
      .output(z.object({}))
      .handler(() => ({}))

    await cmd.parseAsync(["--llms"], { from: "user" })
    const tool = JSON.parse(written).tools[1]
    expect(Object.keys(tool.inputSchema.properties)).toEqual(["sourcePath", "toPath"])
    expect(written).not.toContain('"name": "to"')
    expect(written).not.toContain("fireargs")
  })

  it("throws when two fields derive the same flag", () => {
    expect(() =>
      captureInput(z.object({ toPath: z.string(), "to-path": z.string() })),
    ).toThrow(/conflicting flag/)
  })
})

describe("CLI value parsing", () => {
  it("applies f.option parse to the argv string", async () => {
    const { cmd, read } = createCapturingCommand(
      z.object({
        missing: f.option({ parse: v => v.split(",") }).schema(z.array(z.string())),
      }),
    )

    await cmd.parseAsync(["--missing", "a,b"], { from: "user" })
    expect(read()).toEqual({ missing: ["a", "b"] })
    expect(cmd.helpInformation()).toContain("--missing <value>")
    expect(cmd.helpInformation()).not.toContain("<value...>")
  })

  it("leaves --json input to zod without calling parse", async () => {
    const { cmd, read } = createCapturingCommand(
      z.object({
        missing: f.option({ parse: v => v.split(",") }).schema(z.array(z.string())),
      }),
    )

    await cmd.parseAsync(["--json", '{"missing":["a,b"]}'], { from: "user" })
    expect(read()).toEqual({ missing: ["a,b"] })
  })

  it("parses a value union such as false | number[]", async () => {
    const { cmd, read } = createCapturingCommand(
      z.object({
        headerRows: f
          .option({ parse: v => (v === "false" ? false : v.split(",").map(Number)) })
          .schema(z.union([z.literal(false), z.array(z.number())]).optional()),
      }),
    )

    await cmd.parseAsync(["--header-rows", "false"], { from: "user" })
    expect(read()).toEqual({ headerRows: false })
    await cmd.parseAsync(["--header-rows", "1,2"], { from: "user" })
    expect(read()).toEqual({ headerRows: [1, 2] })
  })

  it("takes a value even when a parsed field is boolean", async () => {
    const { cmd, read } = createCapturingCommand(
      z.object({
        on: f.option({ parse: v => v === "yes" }).schema(z.boolean().optional()),
      }),
    )

    await cmd.parseAsync(["--on", "yes"], { from: "user" })
    expect(read()).toEqual({ on: true })
  })

  it("applies parse to env values", async () => {
    const { cmd, read } = createCapturingCommand(
      z.object({
        tags: f
          .option({ env: "FIREARGS_TEST_TAGS", parse: v => v.split(",") })
          .schema(z.array(z.string()).optional()),
      }),
    )

    process.env.FIREARGS_TEST_TAGS = "a,b"
    try {
      await cmd.parseAsync([], { from: "user" })
      expect(read()).toEqual({ tags: ["a", "b"] })
    } finally {
      delete process.env.FIREARGS_TEST_TAGS
    }
  })

  it("applies f.argument parse to the positional string", async () => {
    const { cmd, read } = createCapturingCommand(
      z.object({
        pairs: f
          .argument({
            parse: v => Object.fromEntries(v.split(",").map(p => p.split(":"))),
          })
          .schema(z.record(z.string(), z.string())),
      }),
    )

    await cmd.parseAsync(["a:int,b:str"], { from: "user" })
    expect(read()).toEqual({ pairs: { a: "int", b: "str" } })
    expect(cmd.helpInformation()).toContain("<pairs>")
  })

  it("reports a throwing parse as an invalid commander argument", async () => {
    const { cmd } = createCapturingCommand(
      z.object({
        props: f.option({ parse: v => JSON.parse(v) }).schema(z.object({}).optional()),
      }),
    )

    await expect(
      cmd.parseAsync(["--props", "{"], { from: "user" }),
    ).rejects.toMatchObject({ code: "commander.invalidArgument" })
  })

  it("keeps parse in the field meta", () => {
    const parse = (v: string) => v.split(",")
    const schema = f.option({ parse }).schema(z.array(z.string()))
    expect(readFieldMeta(schema)).toEqual({ kind: "option", parse })
  })

  it("rejects a schema that cannot accept what parse returns", () => {
    // @ts-expect-error parse returns string[] but the schema takes a string
    f.option({ parse: v => v.split(",") }).schema(z.string())
    f.option({ parse: v => v.split(",") }).schema(z.array(z.string()).optional())
    f.option().schema(z.string())
  })

  it("coerces CLI strings for z.number() fields", async () => {
    const { cmd, read } = createCapturingCommand(
      z.object({
        rows: z.number().int().optional(),
        ratio: f.option({ short: "r" }).number(),
        page: f.argument().schema(z.int().optional()),
      }),
    )

    await cmd.parseAsync(["2", "--rows", "10", "-r", "0.5"], { from: "user" })
    expect(read()).toEqual({ rows: 10, ratio: 0.5, page: 2 })
  })

  it("rejects a CLI string that is not a number", async () => {
    const { cmd } = createCapturingCommand(z.object({ rows: z.number().optional() }))

    for (const value of ["abc", ""]) {
      await expect(
        cmd.parseAsync(["--rows", value], { from: "user" }),
      ).rejects.toMatchObject({ code: "commander.invalidArgument" })
    }
  })

  it("coerces each value of a variadic number field", async () => {
    const { cmd, read } = createCapturingCommand(
      z.object({
        ids: f.argument().schema(z.array(z.number()).optional()),
        rows: z.array(z.number()).default([1]),
      }),
    )

    await cmd.parseAsync([], { from: "user" })
    expect(read()).toEqual({ ids: [], rows: [1] })
    await cmd.parseAsync(["7", "8", "--rows", "2", "3", "--rows", "4"], { from: "user" })
    expect(read()).toEqual({ ids: [7, 8], rows: [2, 3, 4] })
  })

  it("keeps --json number fields strict", async () => {
    const { cmd } = createCapturingCommand(z.object({ rows: z.number() }))

    await expect(
      cmd.parseAsync(["--json", '{"rows":"3"}'], { from: "user" }),
    ).rejects.toMatchObject({ code: "fireargs.invalidInput" })
  })
})

describe("--llms schemas", () => {
  it("describes a transformed input field by its input type", async () => {
    const tool = await readLeafTool(
      z.object({
        list: z
          .string()
          .transform(v => v.split(","))
          .optional(),
      }),
      z.object({}),
    )
    expect(tool.inputSchema.properties.list).toEqual({ type: "string" })
  })

  it("describes a parsed field by its schema type, without meta", async () => {
    const tool = await readLeafTool(
      z.object({
        missing: f.option({ parse: v => v.split(",") }).schema(z.array(z.string())),
      }),
      z.object({}),
    )
    expect(tool.inputSchema.properties.missing).toEqual({
      type: "array",
      items: { type: "string" },
    })
  })

  it("leaves defaulted input fields out of required", async () => {
    const tool = await readLeafTool(
      z.object({ name: z.string(), times: z.number().default(1) }),
      z.object({ count: z.number().default(0) }),
    )
    expect(tool.inputSchema.required).toEqual(["name"])
    expect(tool.outputSchema.required).toEqual(["count"])
  })

  it("writes unrepresentable fields as an unconstrained schema", async () => {
    const tool = await readLeafTool(
      z.object({ at: z.date().optional() }),
      z.object({ size: z.string().transform(v => v.length) }),
    )
    expect(tool.inputSchema.properties.at).toEqual({})
    expect(tool.outputSchema.properties.size).toEqual({})
  })
})

function createCapturingCommand<I extends z.ZodObject>(input: I) {
  let captured: unknown
  const cmd = f
    .command({
      name: "greet",
      exitOverride: true,
      configureOutput: { writeOut: () => {}, writeErr: () => {} },
    })
    .input(input)
    .output(z.object({}))
    .handler(parsed => {
      captured = parsed
      return {}
    })
  return { cmd, read: () => captured }
}

async function readLeafTool(input: z.ZodObject, output: z.ZodObject) {
  let captured = ""
  const cmd = f
    .command({
      name: "greet",
      configureOutput: {
        writeOut: str => {
          captured += str
        },
      },
    })
    .input(input)
    .output(output)
    .handler(() => ({}))

  await cmd.parseAsync(["--llms"], { from: "user" })
  return JSON.parse(captured).tools[1]
}

describe("f.command handler context", () => {
  async function runWithContext(argv: string[]) {
    let seen: CommandContext | undefined
    const cmd = f
      .command({ name: "greet", configureOutput: { writeOut: () => {} } })
      .input(z.object({ name: z.string().default("world") }))
      .output(z.object({}))
      .handler((_input, ctx) => {
        seen = ctx
        return {}
      })
    await cmd.parseAsync(argv, { from: "user" })
    return { cmd, seen }
  }

  it("reports human mode without --json", async () => {
    const { cmd, seen } = await runWithContext([])
    expect(seen?.json).toBe(false)
    expect(seen?.command).toBe(cmd)
  })

  it("reports JSON mode for a bare --json", async () => {
    const { seen } = await runWithContext(["--json"])
    expect(seen?.json).toBe(true)
  })

  it("reports JSON mode for --json with a value", async () => {
    const { seen } = await runWithContext(["--json", '{"name":"x"}'])
    expect(seen?.json).toBe(true)
  })
})

describe("f.command .render", () => {
  function buildRendered(render: (output: { size: number }) => string | void) {
    let captured = ""
    const cmd = f
      .command({
        name: "measure",
        configureOutput: {
          writeOut: str => {
            captured += str
          },
        },
      })
      .input(z.object({ text: f.argument().string() }))
      .output(z.object({ size: z.number().transform(n => n * 10) }))
      .render(render)
      .handler(input => ({ size: input.text.length }))
    return { cmd, read: () => captured }
  }

  it("writes a returned string to writeOut in human mode", async () => {
    const { cmd, read } = buildRendered(output => `size ${output.size}`)
    await cmd.parseAsync(["abc"], { from: "user" })
    expect(read()).toBe("size 30\n")
  })

  it("receives the parsed input and a human-mode context", async () => {
    let seen: RenderContext<{ text: string }> | undefined
    const cmd = f
      .command({ name: "echo" })
      .input(z.object({ text: f.argument().string() }))
      .output(z.object({}))
      .render((_output, ctx) => {
        seen = ctx
      })
      .handler(() => ({}))

    await cmd.parseAsync(["hi"], { from: "user" })
    expect(seen?.input).toEqual({ text: "hi" })
    expect(seen?.json).toBe(false)
    expect(seen?.command).toBe(cmd)
  })

  it("is skipped in JSON mode", async () => {
    let calls = 0
    const { cmd, read } = buildRendered(() => {
      calls += 1
      return "human"
    })
    await cmd.parseAsync(["abc", "--json"], { from: "user" })
    expect(calls).toBe(0)
    expect(JSON.parse(read())).toEqual({ size: 30 })
  })

  it("prints nothing in human mode without .render", async () => {
    let captured = ""
    const cmd = f
      .command({
        name: "greet",
        configureOutput: {
          writeOut: str => {
            captured += str
          },
        },
      })
      .input(z.object({}))
      .output(z.object({ ok: z.boolean() }))
      .handler(() => ({ ok: true }))

    await cmd.parseAsync([], { from: "user" })
    expect(captured).toBe("")
  })
})

describe("f.command renderError", () => {
  afterEach(() => {
    process.exitCode = undefined
  })

  function buildFailing(props: {
    handler?: () => { ok: boolean }
    render?: () => void
    renderError?: (error: unknown, ctx: CommandContext) => unknown
  }) {
    const out = { stdout: "", stderr: "" }
    const cmd = f
      .command({
        name: "fail",
        exitOverride: true,
        configureOutput: {
          writeOut: str => {
            out.stdout += str
          },
          writeErr: str => {
            out.stderr += str
          },
        },
        renderError:
          props.renderError ??
          ((error, ctx) =>
            ctx.json
              ? { error: describeError(error) }
              : `error: ${describeError(error)}`),
      })
      .input(z.object({ count: z.coerce.number() }))
      .output(z.object({ ok: z.boolean() }))
      .render(props.render ?? (() => {}))
      .handler(props.handler ?? (() => ({ ok: true })))
    return { cmd, out }
  }

  it("writes the hook's value as JSON for invalid --json input", async () => {
    const { cmd, out } = buildFailing({})
    await cmd.parseAsync(["--json", "{not json"], { from: "user" })
    expect(JSON.parse(out.stdout)).toHaveProperty("error")
    expect(process.exitCode).toBe(1)
  })

  it("writes the hook's value as JSON for an input schema failure", async () => {
    const { cmd, out } = buildFailing({})
    await cmd.parseAsync(["--json", '{"count":"x"}'], { from: "user" })
    expect(JSON.parse(out.stdout)).toHaveProperty("error")
    expect(process.exitCode).toBe(1)
  })

  it("writes the hook's value as JSON for a handler exception", async () => {
    const { cmd, out } = buildFailing({
      handler: () => {
        throw new Error("boom")
      },
    })
    await cmd.parseAsync(["--json", '{"count":1}'], { from: "user" })
    expect(JSON.parse(out.stdout)).toEqual({ error: "boom" })
    expect(process.exitCode).toBe(1)
  })

  it("writes the hook's value as JSON for an output schema failure", async () => {
    const { cmd, out } = buildFailing({
      // @ts-expect-error the wrong output type is the point of this test
      handler: () => ({ ok: "yes" }),
    })
    await cmd.parseAsync(["--json", '{"count":1}'], { from: "user" })
    expect(JSON.parse(out.stdout)).toHaveProperty("error")
    expect(process.exitCode).toBe(1)
  })

  it("writes the hook's string to writeErr for a render failure", async () => {
    const { cmd, out } = buildFailing({
      render: () => {
        throw new Error("render broke")
      },
    })
    await cmd.parseAsync(["--count", "1"], { from: "user" })
    expect(out.stdout).toBe("")
    expect(out.stderr).toBe("error: render broke\n")
    expect(process.exitCode).toBe(1)
  })

  it("propagates an error the hook rethrows", async () => {
    const { cmd } = buildFailing({
      handler: () => {
        throw new Error("boom")
      },
      renderError: error => {
        throw error
      },
    })
    await expect(cmd.parseAsync(["--count", "1"], { from: "user" })).rejects.toThrow(
      "boom",
    )
  })
})

describe("f.command versionOption", () => {
  it("prints the version through custom flags", async () => {
    let captured = ""
    const cmd = f
      .command({
        name: "tool",
        version: "1.2.3",
        versionOption: { flags: "-v, --version", description: "show the version" },
        exitOverride: true,
        configureOutput: {
          writeOut: str => {
            captured += str
          },
        },
      })
      .input(z.object({}))
      .output(z.object({}))
      .handler(() => ({}))

    expect(cmd.helpInformation()).toContain("-v, --version")
    expect(cmd.helpInformation()).toContain("show the version")
    await expect(cmd.parseAsync(["-v"], { from: "user" })).rejects.toMatchObject({
      code: "commander.version",
    })
    expect(captured).toBe("1.2.3\n")
  })
})

function describeError(error: unknown) {
  return error instanceof Error ? error.message : String(error)
}
