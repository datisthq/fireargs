import { Command as CommanderCommand } from "commander"
import { describe, expect, expectTypeOf, it } from "vite-plus/test"
import { z } from "zod"
import { f } from "../../index.ts"

describe("f.program", () => {
  it("returns a commander Command with subcommands attached", () => {
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
      .commands({ greet, deploy })

    expectTypeOf(cli).toEqualTypeOf<CommanderCommand>()
    expect(cli).toBeInstanceOf(CommanderCommand)
    expect(cli.name()).toBe("myapp")
    expect(cli.description()).toBe("My CLI")
    expect(cli.commands.map(c => c.name())).toEqual(["greet", "deploy"])
  })

  it("object key overrides leaf name", () => {
    const leaf = f
      .command({ name: "x" })
      .input(z.object({}))
      .output(z.object({}))
      .handler(() => ({}))

    const cli = f.program({ name: "myapp" }).commands({ greet: leaf })
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

    const cli = f.program({ name: "myapp" }).commands({ greet })

    await cli.parseAsync(["greet", "--json", '{"name":"world"}'], {
      from: "user",
    })
    expect(JSON.parse(captured)).toEqual({ greeting: "hello world" })
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
      .commands({ greet, deploy })

    await cli.parseAsync(["--llms"], { from: "user" })
    const manifest = JSON.parse(captured)
    expect(manifest._meta.usage).toContain("--json")
    expect(manifest.tools).toHaveLength(2)
    const greetTool = manifest.tools.find(
      (t: { name: string }) => t.name === "greet",
    )
    const deployTool = manifest.tools.find(
      (t: { name: string }) => t.name === "deploy",
    )
    expect(greetTool.description).toBe("Greets the user")
    expect(greetTool.inputSchema.properties.name).toBeDefined()
    expect(greetTool.outputSchema.properties.greeting).toBeDefined()
    expect(deployTool.inputSchema.properties.env.enum).toEqual([
      "staging",
      "prod",
    ])
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

    const cli = f.program({ name: "myapp" }).commands({ greet })

    await cli.parseAsync(["greet", "--llms"], { from: "user" })
    const manifest = JSON.parse(captured)
    expect(manifest.tools).toHaveLength(1)
    expect(manifest.tools[0].name).toBe("greet")
    expect(manifest.tools[0].inputSchema.properties.name).toBeDefined()
    expect(manifest.tools[0].outputSchema.properties.greeting).toBeDefined()
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
      .commands({ greet })

    const cli = f
      .program({
        name: "myapp",
        configureOutput: {
          writeOut: str => {
            captured += str
          },
        },
      })
      .commands({ api: apiCli })

    await cli.parseAsync(["--llms"], { from: "user" })
    const manifest = JSON.parse(captured)
    expect(manifest.tools).toHaveLength(1)
    expect(manifest.tools[0].name).toBe("api greet")
    expect(manifest.tools[0].description).toBe("Greets")
    expect(manifest.tools[0].inputSchema.properties.name).toBeDefined()
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

    const apiCli = f.program({ name: "api" }).commands({ greet })
    const cli = f.program({ name: "myapp" }).commands({ api: apiCli })

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

    const cli = f
      .program({ name: "myapp", llmsOption: false })
      .commands({ greet })

    expect(cli.helpInformation()).not.toContain("--llms")
    expect(cli.commands[0]?.helpInformation()).toContain("--llms")
  })
})
