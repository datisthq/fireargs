import { defineConfig } from "livemark"

export default defineConfig({
  site: "https://fireargs.dev",
  title: "Fireargs",
  description: "Modern CLI builder",
  logo: "/logo.svg",
  favicon: "/logo.png",
  banner:
    "Fireargs is in technical preview · [Share feedback →](https://github.com/datisthq/fireargs/discussions)",
  include: ["docs/**/*.md", "README.md", "CONTRIBUTING.md"],
  skills: "skills/*/SKILL.md",
  sections: [
    { title: "Docs", prefix: "/", icon: "book-open" },
    {
      title: "Changelog",
      prefix: "/changelog/",
      type: "changelog",
      source: "CHANGELOG.md",
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
      file: "README.md",
      article: {
        title: "Introduction",
        description: "Install fireargs and write your first command.",
        icon: "rocket",
        order: 1,
        path: "/introduction/",
      },
    },
    {
      file: "CONTRIBUTING.md",
      article: {
        title: "Contributing",
        description:
          "How to set up fireargs locally, propose changes, and ship a release.",
        icon: "heart-handshake",
        order: -1,
        path: "/contributing/",
      },
    },
  ],
})
