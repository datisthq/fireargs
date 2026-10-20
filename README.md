# Fireargs

Build CLIs from schemas: typed input and output, composable arguments and options, `--json`
I/O for pipelines and `--llms` manifests for agents.

| Language   | Package                                              | Built on         | Docs                                      |
| ---------- | ---------------------------------------------------- | ---------------- | ----------------------------------------- |
| TypeScript | [`fireargs`](https://www.npmjs.com/package/fireargs) | commander + zod  | [Introduction](/typescript/introduction/) |
| Python     | [`fireargs`](https://pypi.org/project/fireargs/)     | click + pydantic | [Introduction](/python/introduction/)     |

Both packages share one contract: the same `--json` input and output, the same `--llms`
tools and the same input-error messages, held to it by the shared `testsuite/`. This
repository holds every implementation — `typescript/` and `python/`; see
[Contributing](/contributing/) for the layout and the commands.
