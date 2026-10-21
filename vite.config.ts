import { defineConfig } from "vite-plus"

const ignorePatterns = ["**/generated/**"]

export default defineConfig({
  fmt: {
    semi: false,
    printWidth: 90,
    arrowParens: "avoid",
    ignorePatterns: [...ignorePatterns, "**/CHANGELOG.md"],
  },
  lint: {
    ignorePatterns,
    options: {
      typeAware: false,
      typeCheck: false,
    },
  },
  test: {
    include: [".scripts/-test/*.unit.ts"],
    env: { NODE_OPTIONS: "--no-warnings" },
    testTimeout: 60 * 1000,
    silent: "passed-only",
  },
})
