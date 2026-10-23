# Fireargs

Build CLIs from schemas for humans, agents, and scripts: typed input and output, composable
arguments and options, `--llms` manifests and `--json` I/O.

| Language   | Package                                              | Built on                | Docs                                                          |
| ---------- | ---------------------------------------------------- | ----------------------- | ------------------------------------------------------------- |
| Python     | [`fireargs`](https://pypi.org/project/fireargs/)     | click + pydantic        | [Introduction](https://fireargs.dev/python/introduction/)     |
| TypeScript | [`fireargs`](https://www.npmjs.com/package/fireargs) | commander + zod         | [Introduction](https://fireargs.dev/typescript/introduction/) |
| Rust       | [`fireargs`](https://crates.io/crates/fireargs)      | clap + serde + schemars | [Introduction](https://fireargs.dev/rust/introduction/)       |

All packages share one contract: the same `--llms` tools, the same `--json` input and
output and the same input-error messages, held to it by the shared `testsuite/`. This
repository holds every implementation — `python/`, `typescript/` and `rustlang/`; see
[Contributing](CONTRIBUTING.md) for the layout and the commands.
