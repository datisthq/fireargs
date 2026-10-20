import { defineConfig } from "livemark"

export default defineConfig({
  site: "https://fireargs.dev",
  title: "Fireargs",
  description: "Modern CLI builder",
  logo: "/logo.svg",
  favicon: "/logo.png",
  include: [
    "typescript/README.md",
    "typescript/docs/**/*.md",
    "python/README.md",
    "python/docs/**/*.md",
    "README.md",
    "CONTRIBUTING.md",
  ],
  skills: ["typescript/skills/*/SKILL.md", "python/skills/*/SKILL.md"],
  sections: [
    { title: "TypeScript", prefix: "/typescript/", icon: "code-xml" },
    { title: "Python", prefix: "/python/", icon: "code" },
    { title: "Project", prefix: "/", icon: "book-open" },
    {
      title: "Changelog",
      prefix: "/changelog/",
      type: "changelog",
      source: "typescript/CHANGELOG.md",
      version: true,
      icon: "history",
    },
    {
      title: "GitHub",
      type: "custom",
      url: "https://github.com/datisthq/fireargs",
      icon: "github",
    },
  ],
  patches: [
    {
      file: "typescript/README.md",
      article: {
        title: "Introduction",
        description: "Install fireargs and write your first command.",
        icon: "rocket",
        order: 1,
        path: "/typescript/introduction/",
      },
    },
    {
      file: "python/README.md",
      article: {
        title: "Introduction",
        description: "Install fireargs for Python and write your first command.",
        icon: "rocket",
        order: 1,
        path: "/python/introduction/",
      },
    },
    {
      file: "README.md",
      article: {
        title: "Overview",
        description: "One CLI contract, built from schemas, in TypeScript and Python.",
        icon: "book-open",
        order: 1,
        path: "/overview/",
      },
    },
    {
      file: "CONTRIBUTING.md",
      article: {
        title: "Contributing",
        description:
          "How to set up fireargs locally, propose changes, and ship a release.",
        icon: "heart-handshake",
        order: 2,
        path: "/contributing/",
      },
    },
  ],
})
