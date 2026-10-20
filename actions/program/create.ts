import type { ProgramConfig } from "../../models/program-config.ts"
import type { Route } from "../../models/route.ts"
import { compileProgram } from "./compile.ts"

/**
 * Open a program builder for a CLI tree. Pass commander-level config here,
 * then call `.router({ ... })` with a map of commands and nested programs.
 * The terminal `.router(...)` returns a fully-wired `Program`. Each route is
 * attached under its object key (overriding its own `name(...)` if set).
 */
export function createProgram(config: ProgramConfig = {}) {
  return {
    router(routes: Record<string, Route>) {
      return compileProgram(config, routes)
    },
  }
}
