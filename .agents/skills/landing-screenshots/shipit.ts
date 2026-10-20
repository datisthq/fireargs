import { f } from "../../../index.ts"
import { z } from "zod"

const deploy = f
  .command({ name: "deploy", description: "Deploy the current build to an environment." })
  .input(
    z.object({
      env: f.argument().enum(["staging", "production"]).describe("Target environment."),
      region: f
        .option({ short: "r", env: "SHIPIT_REGION" })
        .schema(z.string().default("eu-west-1").describe("Cloud region.")),
      replicas: z.coerce.number().int().min(1).default(2).describe("Instances to run."),
      preview: f
        .option({ short: "p" })
        .schema(z.boolean().default(false).describe("Plan without applying.")),
    }),
  )
  .output(
    z.object({
      url: z.string().describe("Public URL of the deployment."),
      version: z.string(),
      replicas: z.number(),
      status: z.enum(["live", "planned"]),
    }),
  )
  .handler(input => ({
    url: `https://${input.env}.shipit.dev`,
    version: "v2.4.0",
    replicas: input.replicas,
    status: input.preview ? "planned" : "live",
  }))

const migrate = f
  .command({ name: "migrate", description: "Apply pending database migrations." })
  .input(z.object({ to: z.string().optional().describe("Target migration id.") }))
  .output(z.object({ applied: z.array(z.string()) }))
  .handler(() => ({ applied: ["0007_add_teams", "0008_index_users"] }))

const db = f
  .program({ name: "db", description: "Manage the database." })
  .router({ migrate })

const cli = f
  .program({ name: "shipit", description: "Ship apps to the cloud.", version: "2.4.0" })
  .router({ deploy, db })

cli.parseAsync(process.argv)
