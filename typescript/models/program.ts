import { Command as CommanderCommand, type HelpContext } from "commander"

/**
 * A dispatcher built by `f.program(...).router(...)`: a commander `Command`
 * that routes argv to its child commands and programs.
 */
export class Program extends CommanderCommand {
  readonly type = "program"

  // A program always has an action, so commander asks for error help only on `help <unknown>`
  override help(context?: HelpContext | ((str: string) => string)): never {
    if (typeof context === "function") return super.help(context)
    if (context?.error === true) {
      this.error(`error: unknown command '${this.args[1]}'`, {
        code: "commander.unknownCommand",
      })
    }
    return super.help(context)
  }
}
