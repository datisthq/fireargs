import { Command as CommanderCommand } from "commander"
import { afterEach, describe, expect, expectTypeOf, it } from "vite-plus/test"
import { z } from "zod"
import { f, type Program } from "../../index.ts"

describe("f.program", () => {
  it("returns a Program with its routes attached", () => {
    const greet = f
      .command({ name: "greet" })
      .input(z.object({}))
      .output(z.object({}))
      .handler(() => ({}))
    const deploy = f
      .command({ name: "deploy" })
      .input(z.object({}))
      .output(z.object({}))
      .handler(() => ({}))

    const cli = f
      .program({ name: "myapp", description: "My CLI" })
      .router({ greet, deploy })

    expectTypeOf(cli).toEqualTypeOf<Program>()
    expect(cli).toBeInstanceOf(CommanderCommand)
    expect(cli.type).toBe("program")
    expect(cli.name()).toBe("myapp")
    expect(cli.description()).toBe("My CLI")
    expect(cli.commands.map(c => c.name())).toEqual(["greet", "deploy"])
  })

  it("router rejects a raw commander Command", () => {
    const raw = new CommanderCommand("raw")
    // @ts-expect-error a raw commander Command would be missing from --llms
    f.program({ name: "myapp" }).router({ raw })
  })

  it("object key overrides leaf name", () => {
    const leaf = f
      .command({ name: "x" })
      .input(z.object({}))
      .output(z.object({}))
      .handler(() => ({}))

    const cli = f.program({ name: "myapp" }).router({ greet: leaf })
    expect(cli.commands[0]?.name()).toBe("greet")
  })

  it("dispatches subcommand --json invocation", async () => {
    let captured = ""
    const greet = f
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

    const cli = f.program({ name: "myapp" }).router({ greet })

    await cli.parseAsync(["greet", "--json", '{"name":"world"}'], {
      from: "user",
    })
    expect(JSON.parse(captured)).toEqual({ greeting: "hello world" })
  })

  it("requires a leaf's positionals again after a --json dispatch", async () => {
    let captured = ""
    const greet = f
      .command({
        name: "greet",
        exitOverride: true,
        configureOutput: { writeOut: str => (captured += str), writeErr: () => {} },
      })
      .input(z.object({ name: f.argument().string() }))
      .output(z.object({ greeting: z.string() }))
      .handler(input => ({ greeting: `hello ${input.name}` }))

    const cli = f.program({ name: "myapp" }).router({ greet })

    await cli.parseAsync(["greet", "--json", '{"name":"world"}'], { from: "user" })
    expect(JSON.parse(captured)).toEqual({ greeting: "hello world" })
    await expect(cli.parseAsync(["greet"], { from: "user" })).rejects.toMatchObject({
      code: "commander.missingArgument",
      message: "error: missing required argument 'name'",
    })
  })

  it("dispatches kebab-case flags to a nested leaf", async () => {
    let captured: unknown
    const read = f
      .command({ name: "read" })
      .input(z.object({ headerRows: z.coerce.number() }))
      .output(z.object({}))
      .handler(input => {
        captured = input
        return {}
      })

    const cli = f
      .program({ name: "myapp" })
      .router({ table: f.program().router({ read }) })

    await cli.parseAsync(["table", "read", "--header-rows", "2"], { from: "user" })
    expect(captured).toEqual({ headerRows: 2 })
  })

  it("--llms emits a manifest with all subcommand schemas (MCP-style)", async () => {
    let captured = ""
    const greet = f
      .command({ name: "greet", description: "Greets the user" })
      .input(z.object({ name: z.string() }))
      .output(z.object({ greeting: z.string() }))
      .handler(input => ({ greeting: `hello ${input.name}` }))

    const deploy = f
      .command({ name: "deploy", description: "Deploys" })
      .input(z.object({ env: z.enum(["staging", "prod"]) }))
      .output(z.object({ ok: z.boolean() }))
      .handler(() => ({ ok: true }))

    const cli = f
      .program({
        name: "myapp",
        description: "My CLI",
        version: "1.0.0",
        configureOutput: {
          writeOut: str => {
            captured += str
          },
        },
      })
      .router({ greet, deploy })

    await cli.parseAsync(["--llms"], { from: "user" })
    const manifest = JSON.parse(captured)
    expect(manifest.tools).toHaveLength(3)
    expect(manifest.tools[0].name).toBe("help")
    expect(manifest.tools[0].description).toContain("--json")
    const greetTool = manifest.tools.find((t: { name: string }) => t.name === "greet")
    const deployTool = manifest.tools.find((t: { name: string }) => t.name === "deploy")
    expect(greetTool.description).toBe("Greets the user")
    expect(greetTool.inputSchema.properties.name).toBeDefined()
    expect(greetTool.outputSchema.properties.greeting).toBeDefined()
    expect(deployTool.inputSchema.properties.env.enum).toEqual(["staging", "prod"])
  })

  it("--llms keeps the whole tree when one leaf parses or transforms input", async () => {
    let captured = ""
    const table = f
      .command({ name: "table" })
      .input(
        z.object({
          missing: f.option({ parse: v => v.split(",") }).schema(z.array(z.string())),
          list: z
            .string()
            .transform(v => v.split(","))
            .optional(),
        }),
      )
      .output(z.object({}))
      .handler(() => ({}))

    const cli = f
      .program({
        name: "myapp",
        configureOutput: {
          writeOut: str => {
            captured += str
          },
        },
      })
      .router({ data: f.program({ name: "data" }).router({ table }) })

    await cli.parseAsync(["--llms"], { from: "user" })
    const tool = JSON.parse(captured).tools[1]
    expect(tool.name).toBe("data table")
    expect(tool.inputSchema.properties.missing.type).toBe("array")
    expect(tool.inputSchema.properties.list.type).toBe("string")
  })

  it("subcommand --llms still works after attachment", async () => {
    let captured = ""
    const greet = f
      .command({
        name: "greet",
        description: "Greets",
        configureOutput: {
          writeOut: str => {
            captured += str
          },
        },
      })
      .input(z.object({ name: z.string() }))
      .output(z.object({ greeting: z.string() }))
      .handler(input => ({ greeting: `hello ${input.name}` }))

    const cli = f.program({ name: "myapp" }).router({ greet })

    await cli.parseAsync(["greet", "--llms"], { from: "user" })
    const manifest = JSON.parse(captured)
    expect(manifest.tools).toHaveLength(2)
    expect(manifest.tools[0].name).toBe("help")
    expect(manifest.tools[1].name).toBe("greet")
    expect(manifest.tools[1].inputSchema.properties.name).toBeDefined()
    expect(manifest.tools[1].outputSchema.properties.greeting).toBeDefined()
  })

  it("composes recursively: nested programs appear in --llms manifest", async () => {
    let captured = ""
    const greet = f
      .command({ name: "greet", description: "Greets" })
      .input(z.object({ name: z.string() }))
      .output(z.object({ greeting: z.string() }))
      .handler(input => ({ greeting: `hello ${input.name}` }))

    const apiCli = f
      .program({ name: "api", description: "API subtree" })
      .router({ greet })

    const cli = f
      .program({
        name: "myapp",
        configureOutput: {
          writeOut: str => {
            captured += str
          },
        },
      })
      .router({ api: apiCli })

    await cli.parseAsync(["--llms"], { from: "user" })
    const manifest = JSON.parse(captured)
    expect(manifest.tools).toHaveLength(2)
    expect(manifest.tools[0].name).toBe("help")
    expect(manifest.tools[1].name).toBe("api greet")
    expect(manifest.tools[1].description).toBe("Greets")
    expect(manifest.tools[1].inputSchema.properties.name).toBeDefined()
  })

  it("dispatches through nested programs", async () => {
    let captured = ""
    const greet = f
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

    const apiCli = f.program({ name: "api" }).router({ greet })
    const cli = f.program({ name: "myapp" }).router({ api: apiCli })

    await cli.parseAsync(["api", "greet", "--json", '{"name":"world"}'], {
      from: "user",
    })
    expect(JSON.parse(captured)).toEqual({ greeting: "hello world" })
  })

  it("llmsOption: false suppresses --llms on the program only", async () => {
    const greet = f
      .command({ name: "greet" })
      .input(z.object({}))
      .output(z.object({}))
      .handler(() => ({}))

    const cli = f.program({ name: "myapp", llmsOption: false }).router({ greet })

    expect(cli.helpInformation()).not.toContain("--llms")
    expect(cli.commands[0]?.helpInformation()).toContain("--llms")
  })

  it("lists a command under its helpGroup heading in the parent's help", () => {
    const deploy = f
      .command({ description: "Deploys", helpGroup: "Ops:" })
      .input(z.object({}))
      .output(z.object({}))
      .handler(() => ({}))
    const status = f
      .command({ description: "Shows status" })
      .input(z.object({}))
      .output(z.object({}))
      .handler(() => ({}))

    const cli = f.program({ name: "myapp" }).router({ deploy, status })

    expect(cli.helpInformation()).toMatch(/Ops:\n {2}deploy.*Deploys/)
    expect(cli.helpInformation()).toMatch(/Commands:\n {2}status.*Shows status/)
  })

  it("lists a nested program under its helpGroup heading in the parent's help", () => {
    const list = f
      .command({ name: "list" })
      .input(z.object({}))
      .output(z.object({}))
      .handler(() => ({}))
    const users = f
      .program({ description: "Manages users", helpGroup: "Admin:" })
      .router({ list })

    const cli = f.program({ name: "myapp" }).router({ users })

    expect(cli.helpInformation()).toMatch(/Admin:\n {2}users.*Manages users/)
  })

  it("prints the version through custom flags", async () => {
    let captured = ""
    const cli = f
      .program({
        name: "myapp",
        version: "1.2.3",
        versionOption: { flags: "-v, --version" },
        exitOverride: true,
        configureOutput: {
          writeOut: str => {
            captured += str
          },
        },
      })
      .router({})

    await expect(cli.parseAsync(["-v"], { from: "user" })).rejects.toMatchObject({
      code: "commander.version",
    })
    expect(captured).toBe("1.2.3\n")
  })
})

describe("f.program renderError", () => {
  afterEach(() => {
    process.exitCode = undefined
  })

  function buildFailingLeaf(props: { renderError?: () => unknown }) {
    const out = { stdout: "" }
    const leaf = f
      .command({
        name: "migrate",
        configureOutput: {
          writeOut: str => {
            out.stdout += str
          },
        },
        renderError: props.renderError,
      })
      .input(z.object({}))
      .output(z.object({}))
      .handler(() => {
        throw new Error("boom")
      })
    return { leaf, out }
  }

  it("catches an error from a nested leaf", async () => {
    const { leaf, out } = buildFailingLeaf({})
    const db = f.program({ name: "db" }).router({ migrate: leaf })
    const cli = f
      .program({
        name: "myapp",
        renderError: (error, ctx) => ({
          error: error instanceof Error ? error.message : String(error),
          json: ctx.json,
          command: ctx.command.name(),
        }),
      })
      .router({ db })

    await cli.parseAsync(["db", "migrate", "--json"], { from: "user" })
    expect(JSON.parse(out.stdout)).toEqual({
      error: "boom",
      json: true,
      command: "migrate",
    })
    expect(process.exitCode).toBe(1)
  })

  it("lets a leaf's own hook override the program's", async () => {
    const { leaf, out } = buildFailingLeaf({ renderError: () => ({ from: "leaf" }) })
    const cli = f
      .program({ name: "myapp", renderError: () => ({ from: "program" }) })
      .router({ migrate: leaf })

    await cli.parseAsync(["migrate", "--json"], { from: "user" })
    expect(JSON.parse(out.stdout)).toEqual({ from: "leaf" })
  })
})
