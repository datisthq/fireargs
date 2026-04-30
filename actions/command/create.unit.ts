import { Command as CommanderCommand } from "commander"
import { describe, expect, expectTypeOf, it } from "vite-plus/test"
import { z } from "zod"
import { createCommand } from "./create.ts"

describe("createCommand", () => {
  it("returns a commander Command instance", () => {
    const cmd = createCommand({ name: "greet" })
      .input(z.object({}))
      .output(z.object({}))
      .handler(() => ({}))

    expectTypeOf(cmd).toEqualTypeOf<CommanderCommand>()
    expect(cmd).toBeInstanceOf(CommanderCommand)
    expect(cmd.name()).toBe("greet")
  })

  it("applies identity config to the commander Command", () => {
    const cmd = createCommand({
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

  it("declares positional arguments listed in config.arguments", async () => {
    let captured: unknown
    const cmd = createCommand({ name: "greet", arguments: ["name"] })
      .input(z.object({ name: z.string() }))
      .output(z.object({ ok: z.boolean() }))
      .handler(input => {
        captured = input
        return { ok: true }
      })

    await cmd.parseAsync(["world"], { from: "user" })
    expect(captured).toEqual({ name: "world" })
  })

  it("treats unlisted fields as --options and coerces via zod", async () => {
    let captured: unknown
    const cmd = createCommand({ name: "greet" })
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
    const cmd = createCommand({ name: "greet" })
      .input(z.object({ verbose: z.boolean() }))
      .output(z.object({ ok: z.boolean() }))
      .handler(input => {
        captured = input
        return { ok: true }
      })

    await cmd.parseAsync(["--verbose"], { from: "user" })
    expect(captured).toEqual({ verbose: true })
  })

  it("treats optional/default-wrapped positionals as `[key]`", async () => {
    let captured: unknown
    const cmd = createCommand({ name: "greet", arguments: ["name"] })
      .input(z.object({ name: z.string().optional() }))
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
    const cmd = createCommand({
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
    const cmd = createCommand({ name: "greet" })
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

  it("derives choices from z.enum on positionals", async () => {
    let captured: unknown
    const cmd = createCommand({ name: "greet", arguments: ["kind"] })
      .input(z.object({ kind: z.enum(["a", "b"]) }))
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
    const cmd = createCommand({ name: "greet" })
      .input(z.object({ port: z.coerce.number().default(8080) }))
      .output(z.object({ ok: z.boolean() }))
      .handler(input => {
        captured = input
        return { ok: true }
      })

    await cmd.parseAsync([], { from: "user" })
    expect(captured).toEqual({ port: 8080 })
  })

  it("treats z.array fields as variadic", async () => {
    let captured: unknown
    const cmd = createCommand({ name: "greet" })
      .input(z.object({ files: z.array(z.string()) }))
      .output(z.object({ ok: z.boolean() }))
      .handler(input => {
        captured = input
        return { ok: true }
      })

    await cmd.parseAsync(["--files", "a", "b", "c"], { from: "user" })
    expect(captured).toEqual({ files: ["a", "b", "c"] })
  })

  it("treats variadic positionals as `<key...>`", async () => {
    let captured: unknown
    const cmd = createCommand({ name: "greet", arguments: ["files"] })
      .input(z.object({ files: z.array(z.string()) }))
      .output(z.object({ ok: z.boolean() }))
      .handler(input => {
        captured = input
        return { ok: true }
      })

    await cmd.parseAsync(["a", "b"], { from: "user" })
    expect(captured).toEqual({ files: ["a", "b"] })
  })

  it("marks options without default or .optional as mandatory", async () => {
    const cmd = createCommand({ name: "greet" })
      .input(z.object({ name: z.string() }))
      .output(z.object({ ok: z.boolean() }))
      .handler(() => ({ ok: true }))

    await expect(cmd.parseAsync([], { from: "user" })).rejects.toThrow()
  })

  it("propagates zod validation errors from input", async () => {
    const cmd = createCommand({ name: "greet" })
      .input(z.object({ count: z.coerce.number() }))
      .output(z.object({ ok: z.boolean() }))
      .handler(() => ({ ok: true }))

    await expect(
      cmd.parseAsync(["--count", "not-a-number"], { from: "user" }),
    ).rejects.toThrow()
  })

  it("rejects non-object schemas at .input", () => {
    createCommand().input(
      // @ts-expect-error string is not a ZodObject
      z.string(),
    )
  })

  it("rejects non-object schemas at .output", () => {
    createCommand().input(z.object({})).output(
      // @ts-expect-error string is not a ZodObject
      z.string(),
    )
  })

  it("rejects mismatched handler return type", () => {
    createCommand()
      .input(z.object({}))
      .output(z.object({ id: z.number() }))
      .handler(
        // @ts-expect-error id must be a number
        () => ({ id: "x" }),
      )
  })

  it("forwards addHelpText paragraphs to commander", () => {
    let captured = ""
    const cmd = createCommand({
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
    const cmd = createCommand({
      name: "greet",
      exitOverride: true,
      configureOutput: { writeErr: () => {} },
    })
      .input(z.object({ name: z.string() }))
      .output(z.object({}))
      .handler(() => ({}))

    await expect(cmd.parseAsync([], { from: "user" })).rejects.toThrow()
  })

  it("configureOutput captures writeErr", async () => {
    let captured = ""
    const cmd = createCommand({
      name: "greet",
      exitOverride: true,
      configureOutput: {
        writeErr: str => {
          captured += str
        },
      },
    })
      .input(z.object({ name: z.string() }))
      .output(z.object({}))
      .handler(() => ({}))

    await expect(cmd.parseAsync([], { from: "user" })).rejects.toThrow()
    expect(captured).toContain("--name")
  })

  it("registers `on` event listeners", async () => {
    let received: unknown
    const cmd = createCommand({
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
    const cmd = createCommand({ name: "greet", executableDir: "/some/path" })
      .input(z.object({}))
      .output(z.object({}))
      .handler(() => ({}))

    expect(cmd.executableDir()).toBe("/some/path")
  })

  it("requires .input before .output", () => {
    const builder = createCommand()
    expectTypeOf(builder).toHaveProperty("input")
    expectTypeOf(builder).not.toHaveProperty("output")
    expectTypeOf(builder).not.toHaveProperty("handler")
  })

  it("requires .output before .handler", () => {
    const builder = createCommand().input(z.object({}))
    expectTypeOf(builder).toHaveProperty("output")
    expectTypeOf(builder).not.toHaveProperty("handler")
  })
})
