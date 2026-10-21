# Fireargs

Build CLIs from schemas: typed input and output, composable arguments and options, `--json`
I/O for pipelines and `--llms` manifests for agents.

| Language   | Package                                              | Built on         | Docs                                                          |
| ---------- | ---------------------------------------------------- | ---------------- | ------------------------------------------------------------- |
| Python     | [`fireargs`](https://pypi.org/project/fireargs/)     | click + pydantic | [Introduction](https://fireargs.dev/python/introduction/)     |
| TypeScript | [`fireargs`](https://www.npmjs.com/package/fireargs) | commander + zod  | [Introduction](https://fireargs.dev/typescript/introduction/) |

Both packages share one contract: the same `--json` input and output, the same `--llms`
tools and the same input-error messages, held to it by the shared `testsuite/`. This
repository holds every implementation — `python/` and `typescript/`; see
[Contributing](CONTRIBUTING.md) for the layout and the commands.
