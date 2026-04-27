import { defineConfig } from "livemark"

export default defineConfig({
  site: "https://fireargs.dev",
  title: "Fireargs",
  description: "Fireargs description",
  logo: "/logo.svg",
  include: ["docs/**/*.md", "README.md"],
  sections: [
    { title: "Docs", prefix: "/" },
    {
      title: "Changelog",
      prefix: "/changelog/",
      type: "changelog",
      source: "https://github.com/datisthq/fireargs",
      version: true,
    },
  ],
  links: [
    {
      url: "https://github.com/datisthq/fireargs",
      title: "GitHub",
      icon: "github",
    },
  ],
  patches: [
    {
      file: "README.md",
      article: {
        title: "Introduction",
        description: "Install fireargs and get started.",
        icon: "rocket",
        order: 1,
        path: "/introduction/",
      },
    },
  ],
})
