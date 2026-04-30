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
