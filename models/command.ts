import { Command as CommanderCommand } from "commander"

/**
 * A leaf built by `f.command(...).handler(...)`: a commander `Command` with
 * typed input, output and a handler.
 */
export class Command extends CommanderCommand {
  readonly type = "command"
}
