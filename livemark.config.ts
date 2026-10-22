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
    "python/CHANGELOG.md",
    "typescript/README.md",
    "typescript/docs/**/*.md",
    "typescript/CONTRIBUTING.md",
    "typescript/CHANGELOG.md",
    "rustlang/README.md",
    "rustlang/docs/**/*.md",
    "rustlang/CONTRIBUTING.md",
    "rustlang/CHANGELOG.md",
  ],
  skills: [
    "python/skills/*/SKILL.md",
    "typescript/skills/*/SKILL.md",
    "rustlang/skills/*/SKILL.md",
  ],
  sections: [
    { title: "Python", prefix: "/python/", icon: "code" },
    { title: "TypeScript", prefix: "/typescript/", icon: "code-xml" },
    { title: "Rust", prefix: "/rust/", icon: "cog" },
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
        order: -2,
        path: "/python/contributing/",
      },
    },
    {
      file: "python/CHANGELOG.md",
      article: {
        title: "Changelog",
        description: "What changed in each release of the Python package.",
        icon: "history",
        order: -1,
        path: "/python/changelog/",
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
        order: -2,
        path: "/typescript/contributing/",
      },
    },
    {
      file: "typescript/CHANGELOG.md",
      article: {
        title: "Changelog",
        description: "What changed in each release of the TypeScript package.",
        icon: "history",
        order: -1,
        path: "/typescript/changelog/",
      },
    },
    {
      file: "rustlang/README.md",
      article: {
        title: "Introduction",
        description: "Install fireargs for Rust and write your first command.",
        icon: "rocket",
        order: 1,
        path: "/rust/introduction/",
      },
    },
    {
      file: "rustlang/CONTRIBUTING.md",
      article: {
        title: "Contributing",
        description:
          "How to set up fireargs locally, propose changes, and ship a release.",
        icon: "heart-handshake",
        order: -2,
        path: "/rust/contributing/",
      },
    },
    {
      file: "rustlang/CHANGELOG.md",
      article: {
        title: "Changelog",
        description: "What changed in each release of the Rust package.",
        icon: "history",
        order: -1,
        path: "/rust/changelog/",
      },
    },
  ],
})
