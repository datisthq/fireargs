import { spawnSync } from "node:child_process"
import { readFileSync, readdirSync } from "node:fs"
import { join, resolve } from "node:path"
import { Ajv2020 } from "ajv/dist/2020.js"
import { describe, expect, it } from "vite-plus/test"

const SUITE = resolve(import.meta.dirname, "..", "..", "conformance")
const FIXTURE = join(import.meta.dirname, "fixture.ts")

type Case = {
  description: string
  fixture?: "program" | "command"
  argv: string[]
  env?: Record<string, string>
  exitCode: number
  stdout?: unknown
  stdoutText?: string
  stderr?: string
  tools?: { name: string; description?: string }[]
  instances?: { tool: string; io: "input" | "output"; data: unknown; valid: boolean }[]
}

type Tool = {
  name: string
  description?: string
  inputSchema: object
  outputSchema: object
}

const ajv = new Ajv2020({ strict: false })
const validateFile = ajv.compile(readSchema(join(SUITE, "test-schema.json")))

for (const area of readdirSync(join(SUITE, "tests"))) {
  for (const file of readdirSync(join(SUITE, "tests", area))) {
    const groups = readGroups(join(SUITE, "tests", area, file))

    describe(`conformance ${area}/${file}`, () => {
      it("matches the test schema", () => {
        expect(validateFile(groups), ajv.errorsText(validateFile.errors)).toBe(true)
      })

      for (const group of groups) {
        for (const test of group.tests) {
          it(`${group.description} › ${test.description}`, () => runCase(test))
        }
      }
    })
  }
}

function runCase(test: Case) {
  const env = {
    ...process.env,
    FIREARGS_CONFORMANCE_FIXTURE: test.fixture ?? "program",
    ...test.env,
  }
  const run = spawnSync("node", [FIXTURE, ...test.argv], { encoding: "utf8", env })
  expect(run.status, run.stderr).toBe(test.exitCode)
  if (test.stdout !== undefined) expect(JSON.parse(run.stdout)).toEqual(test.stdout)
  if (test.stdoutText !== undefined) expect(run.stdout).toBe(test.stdoutText)
  if (test.stderr !== undefined)
    expect(run.stderr.startsWith(test.stderr), run.stderr).toBe(true)
  if (test.tools === undefined && test.instances === undefined) return

  const manifest: { tools: Tool[] } = JSON.parse(run.stdout)
  const tools = manifest.tools
  if (test.tools !== undefined) {
    expect(tools.map(({ name, description }) => ({ name, description }))).toEqual(
      test.tools.map(({ name, description }) => ({ name, description })),
    )
  }
  for (const instance of test.instances ?? []) {
    const tool = tools.find(candidate => candidate.name === instance.tool)
    if (tool === undefined) throw new Error(`no tool named ${instance.tool}`)
    const schema = instance.io === "input" ? tool.inputSchema : tool.outputSchema
    const label = `${instance.tool} ${instance.io} ${JSON.stringify(instance.data)}`
    expect(ajv.validate(schema, instance.data), label).toBe(instance.valid)
  }
}

function readSchema(path: string): object {
  return JSON.parse(readFileSync(path, "utf8"))
}

function readGroups(path: string): { description: string; tests: Case[] }[] {
  return JSON.parse(readFileSync(path, "utf8"))
}
