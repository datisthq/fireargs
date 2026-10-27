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

const tagsInput = z.object({
  tags: f
    .option({ parse: value => value.split(",") })
    .schema(z.array(z.string()).default([])),
  rows: z.array(z.number().int()).default([]),
  loud: f
    .option({ conflicts: "quiet", implies: { level: 3 } })
    .schema(z.boolean().optional()),
  quiet: z.boolean().optional(),
  level: z.number().int().optional(),
  color: f.option({ preset: "red" }).string().optional(),
})

const tags = f
  .command({ description: "Collect tags and rows" })
  .input(tagsInput)
  .output(tagsInput)
  .handler(input => input)

const pickInput = z.object({
  level: z.union([z.literal(1), z.literal(2)]).optional(),
  pair: z.tuple([z.number().int(), z.string()]).optional(),
  tone: z.enum(["low", "high"]).nullable().optional(),
})

const pick = f
  .command({ description: "Pick typed values" })
  .input(pickInput)
  .output(pickInput)
  .handler(input => input)

const ratio = f
  .command({ description: "Divide zero by zero" })
  .input(z.object({}))
  .output(z.object({ value: z.number() }))
  .handler(() => ({ value: Number.NaN }))

const resetInput = z.object({
  force: f.option({ env: "FIXTURE_FORCE" }).boolean().default(false),
  backup: f.option({ env: "FIXTURE_BACKUP" }).boolean().default(true),
})

const reset = f
  .command({ description: "Reset everything" })
  .input(resetInput)
  .output(resetInput)
  .handler(input => input)

const soloInput = z.object({
  name: f.argument().schema(z.string().default("world").describe("Who to greet")),
  times: f
    .option({ short: "t", env: "SOLO_TIMES" })
    .schema(z.number().int().min(1).default(1).describe("Greetings to print")),
  loud: f.option().schema(z.boolean().default(false)),
})

/**
 * The standalone command `"fixture": "command"` cases run against.
 */
export const solo = f
  .command({ name: "solo", description: "Greet someone", version: "1.2.3" })
  .input(soloInput)
  .output(soloInput)
  .render(output => Array(output.times).fill(`Hello, ${output.name}!`).join("\n"))
  .handler(input => input)

/**
 * The program `conformance/` cases run against by default; `python/fireargs/_test/fixture.py` is its twin.
 */
export const fixture = f.program({ name: "fixture" }).router({
  echo,
  strict,
  tags,
  pick,
  ratio,
  admin: f.program({ description: "Admin tasks" }).router({ reset }),
})

if (import.meta.main) {
  const command = process.env.FIREARGS_CONFORMANCE_FIXTURE === "command"
  await (command ? solo : fixture).parseAsync()
}
