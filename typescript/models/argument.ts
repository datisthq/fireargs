import { Argument } from "commander"

export class FieldArgument extends Argument {
  readonly declaredRequired = this.required
  readonly tokens: string[] = []
}
