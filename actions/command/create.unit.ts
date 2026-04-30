import { Command as CommanderCommand } from "commander"
import { describe, expect, expectTypeOf, it } from "vite-plus/test"
import { z } from "zod"
import { f } from "../../index.ts"

describe("f.command", () => {
  it("returns a commander Command instance", () => {
    const cmd = f
      .command({ name: "greet" })
      .input(z.object({}))
      .output(z.object({}))
      .handler(() => ({}))

    expectTypeOf(cmd).toEqualTypeOf<CommanderCommand>()
    expect(cmd).toBeInstanceOf(CommanderCommand)
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
    await expect(
      cmd.parseAsync(["--kind", "z"], { from: "user" }),
    ).rejects.toThrow()
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

    await expect(cmd.parseAsync([], { from: "user" })).rejects.toThrow()
  })

  it("propagates zod validation errors from input", async () => {
    const cmd = f
      .command({ name: "greet" })
      .input(z.object({ count: z.coerce.number() }))
      .output(z.object({ ok: z.boolean() }))
      .handler(() => ({ ok: true }))

    await expect(
      cmd.parseAsync(["--count", "not-a-number"], { from: "user" }),
    ).rejects.toThrow()
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
          port: f
            .option({ env: "FIREARGS_TEST_PORT" })
            .schema(z.coerce.number()),
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

    await expect(
      cmd.parseAsync(["--rgb", "--cmyk"], { from: "user" }),
    ).rejects.toThrow()
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

  it("rejects non-object schemas at .output", () => {
    f.command().input(z.object({})).output(
      // @ts-expect-error string is not a ZodObject
      z.string(),
    )
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
    ).rejects.toThrow()
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
    expect(manifest.readme).toContain("greet --json")
    expect(manifest.command).toEqual({
      name: "greet",
      description: "Greet someone",
    })
    expect(manifest.input.type).toBe("object")
    expect(manifest.input.properties.name).toBeDefined()
    expect(manifest.output.type).toBe("object")
    expect(manifest.output.properties.greeting).toBeDefined()
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
    expect(manifest.input.properties.name.fireargs).toBeUndefined()
    expect(manifest.input.properties.verbose.fireargs).toBeUndefined()
    expect(manifest.input.properties.name.description).toBe("user's name")
    expect(manifest.input.properties.times.default).toBe(1)
    expect(manifest.input.properties.kind.enum).toEqual(["a", "b"])
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
})
