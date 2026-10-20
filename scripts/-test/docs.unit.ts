import { existsSync, readFileSync, readdirSync, realpathSync } from "node:fs"
import { join, resolve } from "node:path"
import { describe, expect, it } from "vite-plus/test"

const ROOT = resolve(import.meta.dirname, "..", "..")
const REPO_SKILLS = join(ROOT, ".agents", "skills")
const SECTIONS = ["typescript", "python"].filter(name => existsSync(join(ROOT, name)))
const SHIPPED_SKILLS = SECTIONS.map(name => join(ROOT, name, "skills")).filter(existsSync)

describe("documentation stays true", () => {
  it("wires .claude/skills to .agents/skills", () => {
    const linked = realpathSync(join(ROOT, ".claude", "skills"))
    expect(linked).toBe(realpathSync(REPO_SKILLS))
  })

  it("keeps exactly one AGENTS.md, at the root", () => {
    const stray: string[] = []
    const walk = (directory: string) => {
      for (const entry of readdirSync(directory, { withFileTypes: true })) {
        if (entry.name === "node_modules" || entry.name.startsWith(".")) continue
        const path = join(directory, entry.name)
        if (entry.isDirectory()) walk(path)
        else if (entry.name === "AGENTS.md" && directory !== ROOT) {
          stray.push(path.slice(ROOT.length + 1))
        }
      }
    }
    walk(ROOT)
    expect(stray).toEqual([])
  })

  it("names only paths that exist", () => {
    const missing: string[] = []
    for (const doc of readDocs()) {
      for (const [, span = ""] of doc.text.matchAll(PATH_SPAN)) {
        if (!looksLikeRepoPath(span)) continue
        if (!existsSync(join(ROOT, span))) missing.push(`${doc.path}: ${span}`)
      }
    }
    expect(missing).toEqual([])
  })

  it("names only pnpm scripts that exist", () => {
    const scripts = readScripts(ROOT)
    const missing: string[] = []
    for (const doc of readDocs()) {
      const commands = [
        ...doc.text.matchAll(/`([^`\n]*pnpm [^`\n]*)`/g),
        ...doc.text.matchAll(/^\s*(pnpm .+)$/gm),
      ].map(match => match[1] ?? "")
      for (const [, section, script = ""] of commands
        .join("\n")
        .matchAll(/pnpm (?:-C ([a-z]+) )?([a-z][a-z0-9:-]*)/g)) {
        if (PNPM_BUILTINS.includes(script)) continue
        const known = section ? readScripts(join(ROOT, section)) : scripts
        if (!known.includes(script)) {
          missing.push(`${doc.path}: pnpm ${section ? `-C ${section} ` : ""}${script}`)
        }
      }
    }
    expect(missing).toEqual([])
  })

  it("gives every skill a name and a short description", () => {
    const problems: string[] = []
    for (const directory of [REPO_SKILLS, ...SHIPPED_SKILLS]) {
      for (const name of readdirSync(directory)) {
        const path = join(directory, name, "SKILL.md")
        if (!existsSync(path)) {
          problems.push(`${name}: no SKILL.md`)
          continue
        }
        const [, frontmatter = ""] = readFileSync(path, "utf8").split("---", 2)
        if (!new RegExp(`^name: ${name}$`, "m").test(frontmatter)) {
          problems.push(`${name}: frontmatter name must match the directory`)
        }
        // A description over the listing budget is cut to a bare name, and the skill is
        // then found only through the AGENTS.md table.
        const description = /^description: (.*)$/m.exec(frontmatter)?.[1] ?? ""
        if (!description) problems.push(`${name}: no description`)
        if (description.length > 250) {
          problems.push(`${name}: description is ${description.length} chars, keep ≤ 250`)
        }
      }
    }
    expect(problems).toEqual([])
  })

  it("lists every skill in the AGENTS.md tables, and only those", () => {
    const agents = readFileSync(join(ROOT, "AGENTS.md"), "utf8")
    const listed = [...agents.matchAll(/^\| `([a-z-]+)` +\|/gm)].map(match => match[1])
    const skills = [REPO_SKILLS, ...SHIPPED_SKILLS].flatMap(directory =>
      readdirSync(directory),
    )
    expect(listed.toSorted()).toEqual(skills.toSorted())
  })
})

const PATH_SPAN = /`(\.?[a-z0-9][a-z0-9._@/-]*\/[a-z0-9._@/-]+)`/gi

const PNPM_BUILTINS = ["install", "exec", "add", "remove", "dlx", "run", "publish"]

// Only spans rooted at a real top-level directory are checked: the docs also hold
// project-relative examples that are correct and resolve nowhere.
const WORKSPACE = new Set([
  ...readdirSync(ROOT, { withFileTypes: true })
    .filter(entry => entry.isDirectory() && !entry.name.startsWith("."))
    .map(entry => entry.name),
  ".agents",
  ".github",
  ".release",
])

function readScripts(directory: string) {
  const path = join(directory, "package.json")
  if (!existsSync(path)) return []
  return Object.keys(JSON.parse(readFileSync(path, "utf8")).scripts ?? {})
}

function readDocs() {
  const docs = [
    join(ROOT, "AGENTS.md"),
    join(ROOT, "README.md"),
    join(ROOT, "CONTRIBUTING.md"),
    ...readdirSync(REPO_SKILLS).map(name => join(REPO_SKILLS, name, "SKILL.md")),
  ]
  return docs
    .filter(path => existsSync(path))
    .map(path => ({
      path: path.slice(ROOT.length + 1),
      text: readFileSync(path, "utf8"),
    }))
}

function looksLikeRepoPath(span: string) {
  if (span.includes("*") || span.includes("<") || span.includes("://")) return false
  if (span.startsWith("@")) return false
  if (!WORKSPACE.has(span.split("/")[0] ?? "")) return false
  // Build output is gitignored, so a fresh checkout or CI would fail on it.
  if (span.split("/").includes("build")) return false
  return /\.(ts|tsx|json|md|css|yaml|yml|svg|png)$/.test(span) || span.endsWith("/")
}
