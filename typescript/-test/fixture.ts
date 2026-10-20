import { z } from "zod"
import { f } from "../index.ts"

const echoInput = z.object({
  path: f.argument().string().describe("Path to read"),
  limit: f
    .option({ short: "l" })
    .schema(z.number().int().min(1).default(20).describe("Rows to read")),
  role: f.option().schema(z.enum(["admin", "user"]).optional().describe("Role filter")),
  verbose: f.option({ short: "v" }).schema(z.boolean().default(false)),
  headerRows: z.number().int().optional(),
})

const echo = f
  .command({ description: "Echo the input back" })
  .input(echoInput)
  .output(echoInput)
  .handler(input => input)

const strictInput = z.object({ count: z.number().min(10) })

const strict = f
  .command({ description: "Require a count of at least 10" })
  .input(strictInput)
  .output(strictInput)
  .handler(input => input)

const resetInput = z.object({ force: z.boolean().default(false) })

const reset = f
  .command({ description: "Reset everything" })
  .input(resetInput)
  .output(resetInput)
  .handler(input => input)

/**
 * The CLI every `testsuite/` case runs against; `python/fireargs/_test/fixture.py` is its twin.
 */
export const fixture = f.program({ name: "fixture" }).router({
  echo,
  strict,
  admin: f.program({ description: "Admin tasks" }).router({ reset }),
})

if (import.meta.main) await fixture.parseAsync()
