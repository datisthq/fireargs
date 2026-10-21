import { defineConfig } from "livemark"

export default defineConfig({
  site: "https://fireargs.dev",
  title: "Fireargs",
  description: "Modern CLI builder",
  logo: "/logo.svg",
  favicon: "/logo.png",
  include: [
    "python/README.md",
    "python/docs/**/*.md",
    "python/CONTRIBUTING.md",
    "typescript/README.md",
    "typescript/docs/**/*.md",
    "typescript/CONTRIBUTING.md",
  ],
  skills: ["python/skills/*/SKILL.md", "typescript/skills/*/SKILL.md"],
  sections: [
    { title: "Python", prefix: "/python/", icon: "code" },
    { title: "TypeScript", prefix: "/typescript/", icon: "code-xml" },
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
      file: "python/CONTRIBUTING.md",
      article: {
        title: "Contributing",
        description:
          "How to set up fireargs locally, propose changes, and ship a release.",
        icon: "heart-handshake",
        order: -1,
        path: "/python/contributing/",
      },
    },
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
      file: "typescript/CONTRIBUTING.md",
      article: {
        title: "Contributing",
        description:
          "How to set up fireargs locally, propose changes, and ship a release.",
        icon: "heart-handshake",
        order: -1,
        path: "/typescript/contributing/",
      },
    },
  ],
})
