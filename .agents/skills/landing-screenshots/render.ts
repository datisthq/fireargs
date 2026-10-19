import { execSync } from "node:child_process"
import { mkdirSync, writeFileSync } from "node:fs"
import { join } from "node:path"

const SHIPIT = `node ${join(import.meta.dirname, "shipit.ts")}`
const OUT = process.argv[2] ?? "slides"

type Line = string

const palette = {
  light: {
    bg: "#ffffff",
    text: "#4c4f69",
    dim: "#8c8fa1",
    mauve: "#8839ef",
    blue: "#1e66f5",
    green: "#40a02b",
    peach: "#fe640b",
    teal: "#179299",
    red: "#d20f39",
    yellow: "#df8e1d",
    rule: "#e6e9ef",
  },
  dark: {
    bg: "#0a0a0a",
    text: "#cdd6f4",
    dim: "#7f849c",
    mauve: "#cba6f7",
    blue: "#89b4fa",
    green: "#a6e3a1",
    peach: "#fab387",
    teal: "#94e2d5",
    red: "#f38ba8",
    yellow: "#f9e2af",
    rule: "#262626",
  },
}

function esc(s: string) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
}

function span(cls: string, s: string) {
  return `<span class="${cls}">${esc(s)}</span>`
}

function run(cmd: string) {
  return execSync(cmd.replace(/^shipit/, SHIPIT), {
    encoding: "utf8",
    shell: "/bin/bash",
  }).trimEnd()
}

function prompt(cmd: string) {
  const out = (cmd.match(/'[^']*'|\s+|[^\s']+/g) ?? [])
    .map((tok, i) => {
      if (i === 0) return span("blue b", tok)
      if (tok.startsWith("-")) return span("teal", tok)
      if (tok.startsWith("'")) return span("green", tok)
      if (tok === "|") return span("dim", tok)
      if (tok === "jq") return span("blue", tok)
      return esc(tok)
    })
    .join("")
  return `${span("red b", "$")} ${out}`
}

function json(text: string): Line[] {
  const re = /("(?:\\.|[^"\\])*")(\s*:)?|(-?\d+(?:\.\d+)?|true|false|null)|([{}[\],:])/g
  return text.split("\n").map(line => {
    let out = ""
    let last = 0
    for (const m of line.matchAll(re)) {
      out += esc(line.slice(last, m.index))
      if (m[1] && m[2]) out += span("blue", m[1]) + span("dim", m[2])
      else if (m[1]) out += span("green", m[1])
      else if (m[3]) out += span("peach", m[3])
      else out += span("dim", m[0])
      last = (m.index ?? 0) + m[0].length
    }
    return out + esc(line.slice(last))
  })
}

function help(text: string): Line[] {
  return text.split("\n").map(line => {
    if (/^[A-Z][a-z]+:/.test(line)) {
      const [head, ...rest] = line.split(":")
      return `${span("mauve b", `${head}:`)}${esc(rest.join(":"))}`
    }
    const m = line.match(/^(\s{2})(\S.*?)(\s{2,})(.*)$/)
    if (!m) return esc(line)
    const [, ind = "", flags = "", gap = "", desc = ""] = m
    const d = esc(desc).replace(
      /(\((?:default|choices|env)[^)]*\))/g,
      '<span class="dim">$1</span>',
    )
    const f = flags.startsWith("-") ? span("teal", flags) : span("yellow", flags)
    return `${ind}${f}${gap}${d}`
  })
}

function command(cmd: string, kind: "json" | "help" | "raw"): Line[] {
  const out = run(cmd)
  const body =
    kind === "json" ? json(out) : kind === "help" ? help(out) : out.split("\n").map(esc)
  return [prompt(cmd), ...body, ""]
}

function wrap(text: string, width: number) {
  const lines: string[] = []
  let line = ""
  for (const part of text.split(/(?<=,)/)) {
    if (line && line.length + part.length > width) {
      lines.push(line)
      line = ""
    }
    line += part
  }
  return [...lines, line]
}

function agent(): Line[] {
  const user = (s: string) => `${span("mauve b", "›")} ${span("b", s)}`
  const say = (s: string) => `${span("peach", "●")} ${esc(s)}`
  const tool = (cmd: string) => `  ${prompt(cmd)}`
  const result = (lines: Line[]) =>
    lines.map((l, i) => `  ${span("dim", i === 0 ? "⎿ " : "  ")}${l}`)
  const tools = run("shipit --llms | jq -r '[.tools[].name] | join(\", \")'")
  const preview = run(`shipit deploy --json '{"env":"staging","preview":true}' | jq -c .`)
  const live = run(`shipit deploy --json '{"env":"staging"}' | jq -c .`)
  return [
    user("Ship the current build to staging, but preview it first."),
    "",
    say("Checking which tools shipit exposes."),
    tool("shipit --llms"),
    ...result([span("dim", `tools/list: ${tools}`)]),
    "",
    say("Previewing the staging rollout."),
    tool(`shipit deploy --json '{"env":"staging","preview":true}'`),
    ...result(wrap(preview, 56).flatMap(json)),
    "",
    say("Plan looks right: 2 replicas, nothing applied. Deploying."),
    tool(`shipit deploy --json '{"env":"staging"}'`),
    ...result(wrap(live, 56).flatMap(json)),
    "",
    say("Done. Staging runs v2.4.0 at https://staging.shipit.dev"),
  ]
}

const slides: Record<string, Line[]> = {
  help: command("shipit deploy --help", "help"),
  json: [
    ...command("shipit deploy production -r us-east-1 --replicas 4 --json", "json"),
    ...command(
      `shipit deploy --json '{"env":"staging","preview":true}' | jq .status`,
      "json",
    ),
    ...command("shipit db migrate --json", "json"),
  ],
  llms: [
    ...command("shipit --llms | jq '.tools[].name'", "json"),
    ...command("shipit --llms | jq '.tools[1].inputSchema.properties.env'", "json"),
    ...command("shipit --llms | jq -c '.tools[1].outputSchema.required'", "json"),
  ],
  agent: agent(),
}

mkdirSync(OUT, { recursive: true })
for (const [id, lines] of Object.entries(slides)) {
  for (const [theme, c] of Object.entries(palette)) {
    const css = Object.entries(c)
      .map(([k, v]) => `.${k}{color:${v}}`)
      .join("")
    const html = `<!doctype html><html><head><meta charset="utf-8">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;700&display=swap" rel="stylesheet">
<style>
html,body{margin:0;width:960px;height:600px;overflow:hidden;background:${c.bg};color:${c.text}}
pre{margin:0;padding:26px 30px;font:13px/1.6 "JetBrains Mono",ui-monospace,monospace;white-space:pre-wrap;font-variant-ligatures:none}
.b{font-weight:700}${css}
</style></head><body><pre>${lines.join("\n").trimEnd()}</pre></body></html>`
    writeFileSync(join(OUT, `${id}-${theme}.html`), html)
  }
}
