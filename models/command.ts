import { Command as CommanderCommand } from "commander"
import { FieldArgument } from "./argument.ts"

/**
 * A leaf built by `f.command(...).handler(...)`: a commander `Command` with
 * typed input, output and a handler.
 */
export class Command extends CommanderCommand {
  readonly type = "command"

  override restoreStateBeforeParse() {
    super.restoreStateBeforeParse()
    // `--json <value>` and `--llms` relax positionals for one parse; without this
    // reset the next parse of the same instance would accept missing ones
    for (const arg of this.registeredArguments) {
      if (arg instanceof FieldArgument) arg.required = arg.declaredRequired
    }
  }
}
