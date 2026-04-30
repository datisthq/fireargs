import { describe, expect, it } from "vite-plus/test"
import { z } from "zod"
import { markArgument } from "./mark.ts"
import { isArgument } from "./read.ts"

describe("markArgument / isArgument", () => {
  it("returns true for marked schemas", () => {
    expect(isArgument(markArgument(z.string()))).toBe(true)
  })

  it("returns false for unmarked schemas", () => {
    expect(isArgument(z.string())).toBe(false)
  })

  it("preserves parsing behavior", () => {
    expect(markArgument(z.string()).parse("hi")).toBe("hi")
  })
})
