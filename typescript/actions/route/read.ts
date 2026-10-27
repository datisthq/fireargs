import type { Command as CommanderCommand } from "commander"

/**
 * Read the space-separated path from the root program down to a mounted route,
 * the root left out: `""` for the root itself.
 */
export function readRoutePath(route: CommanderCommand) {
  const names: string[] = []
  for (let cmd = route; cmd.parent !== null; cmd = cmd.parent) names.unshift(cmd.name())
  return names.join(" ")
}
