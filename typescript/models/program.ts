import { Command as CommanderCommand } from "commander"

/**
 * A dispatcher built by `f.program(...).router(...)`: a commander `Command`
 * that routes argv to its child commands and programs.
 */
export class Program extends CommanderCommand {
  readonly type = "program"
}
