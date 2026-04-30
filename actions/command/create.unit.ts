import { describe, expect, expectTypeOf, it } from "vite-plus/test"
import { z } from "zod"
import { createArgument } from "../argument/create.ts"
import { createCommand } from "./create.ts"

describe("createCommand", () => {
  it("builds a command from input + output + handler", async () => {
    const cmd = createCommand()
      .input(z.object({ name: createArgument(z.string()) }))
      .output(z.object({ greeting: z.string() }))
      .handler(input => ({ greeting: `hello ${input.name}` }))

    expect(await cmd.handler({ name: "world" })).toEqual({
      greeting: "hello world",
    })
  })

  it("preserves z.infer through createArgument", () => {
    createCommand()
      .input(
        z.object({
          name: createArgument(z.string()),
          times: z.number().default(1),
          verbose: z.boolean(),
        }),
      )
      .output(z.object({ ok: z.boolean() }))
      .handler(input => {
        expectTypeOf(input).toEqualTypeOf<{
          name: string
          times: number
          verbose: boolean
        }>()
        return { ok: true }
      })
  })

  it("constrains handler return type to the output schema", () => {
    createCommand()
      .input(z.object({}))
      .output(z.object({ id: z.number() }))
      .handler(() => {
        return { id: 1 }
      })
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

  it("requires .input before .handler", () => {
    const builder = createCommand()
    expectTypeOf(builder).toHaveProperty("input")
    expectTypeOf(builder).not.toHaveProperty("handler")
  })

  it("requires .output before .handler", () => {
    const builder = createCommand().input(z.object({}))
    expectTypeOf(builder).toHaveProperty("output")
    expectTypeOf(builder).not.toHaveProperty("handler")
  })
})
