import { basename, dirname, join } from "node:path"
import { coverageConfigDefaults, defineConfig } from "vite-plus"

const ignorePatterns = ["**/generated/**"]

export default defineConfig({
  fmt: {
    semi: false,
    printWidth: 80,
    arrowParens: "avoid",
    ignorePatterns,
  },
  lint: {
    ignorePatterns,
    options: {
      typeAware: false,
      typeCheck: false,
    },
  },
  test: {
    include: ["**/*.unit.(ts|tsx)"],
    exclude: ["**/node_modules/**", "**/build/**"],
    env: { NODE_OPTIONS: "--no-warnings" },
    testTimeout: 60 * 1000,
    passWithNoTests: true,
    silent: "passed-only",
    coverage: {
      enabled: true,
      reporter: ["html", "json"],
      exclude: [
        ...coverageConfigDefaults.exclude,
        "**/@*",
        "**/build/**",
        "**/compile/**",
        "**/coverage/**",
        "**/docs/**",
        "**/.livemark/**",
        "**/entrypoints/**",
        "**/examples/**",
        "**/messages.js",
        "**/program.ts",
        "**/index.ts",
        "**/main.ts",
      ],
    },
    resolveSnapshotPath: (testPath: string, snapExtension: string) => {
      return (
        join(dirname(testPath), "fixtures", "generated", basename(testPath)) +
        snapExtension
      )
    },
  },
})
