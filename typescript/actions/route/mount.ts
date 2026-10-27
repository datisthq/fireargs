import type { Command as CommanderCommand } from "commander"
import type { CommandConfig } from "../../models/config.ts"
import type { Program } from "../../models/program.ts"
import type { Route } from "../../models/route.ts"

type Settings = Pick<CommandConfig, "exitOverride" | "configureOutput">

type Registration = { rebuild: () => Route; own: Settings }

const registrations = new WeakMap<CommanderCommand, Registration>()

/**
 * Mount a route on a program under `key`. A route already mounted somewhere is
 * rebuilt from its config, since commander keeps one parent per command.
 */
export function mountRoute(program: Program, key: string, route: Route) {
  const mounted = route.parent === null ? route : rebuildRoute(route)
  mounted.name(key)
  program.addCommand(mounted)
  return mounted
}

/**
 * Register how to rebuild a compiled route, and the inheritable settings it set itself.
 */
export function registerRoute(route: Route, rebuild: () => Route, own: Settings) {
  registrations.set(route, {
    rebuild,
    own: { exitOverride: own.exitOverride, configureOutput: own.configureOutput },
  })
}

/**
 * Push a program's `exitOverride` and `configureOutput` down to every route below
 * it, except where a route set its own: commander's `addCommand` copies neither.
 */
export function inheritRouteSettings(program: Program) {
  const own = registrations.get(program)?.own
  if (own === undefined) return
  if (own.exitOverride === undefined && own.configureOutput === undefined) return
  pushSettings(program, own)
}

function rebuildRoute(route: Route) {
  return registrations.get(route)?.rebuild() ?? route
}

function pushSettings(parent: CommanderCommand, inherited: Settings) {
  for (const sub of parent.commands) {
    const own = registrations.get(sub)?.own
    const settings: Settings = {
      exitOverride: own?.exitOverride ?? inherited.exitOverride,
      configureOutput: { ...inherited.configureOutput, ...own?.configureOutput },
    }
    if (settings.exitOverride === true) sub.exitOverride()
    else if (typeof settings.exitOverride === "function") {
      sub.exitOverride(settings.exitOverride)
    }
    if (settings.configureOutput !== undefined)
      sub.configureOutput(settings.configureOutput)
    pushSettings(sub, settings)
  }
}
