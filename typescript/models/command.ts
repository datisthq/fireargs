import { Command as CommanderCommand } from "commander"
import { FieldArgument } from "./argument.ts"
import { FieldOption } from "./option.ts"

/**
 * A leaf built by `f.command(...).handler(...)`: a commander `Command` with
 * typed input, output and a handler.
 */
export class Command extends CommanderCommand {
  readonly type = "command"

  override restoreStateBeforeParse() {
    super.restoreStateBeforeParse()
    // `--json <value>` and `--llms` relax positionals for one parse, and tokens are
    // one parse's: unreset, the next parse would accept missing ones or quote stale ones
    for (const arg of this.registeredArguments) {
      if (arg instanceof FieldArgument) {
        arg.required = arg.declaredRequired
        arg.tokens.length = 0
      }
    }
    for (const opt of this.options) {
      if (opt instanceof FieldOption) opt.tokens.length = 0
    }
  }
}
