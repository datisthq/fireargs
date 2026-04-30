import { describe, expect, it } from "vite-plus/test"
import { z } from "zod"
import { createArgument } from "./create.ts"
import { isArgument } from "./read.ts"

describe("createArgument / isArgument", () => {
  it("returns true for marked schemas", () => {
    expect(isArgument(createArgument(z.string()))).toBe(true)
  })

  it("returns false for unmarked schemas", () => {
    expect(isArgument(z.string())).toBe(false)
  })

  it("preserves parsing behavior", () => {
    expect(createArgument(z.string()).parse("hi")).toBe("hi")
  })
})
