# Changelog

## [0.4.1](https://github.com/datisthq/fireargs/compare/v0.4.0...v0.4.1) (2026-09-11)


### Bug Fixes

* **release:** keep the v-prefixed tag format ([d61fcb6](https://github.com/datisthq/fireargs/commit/d61fcb6879dfe7a315bbbbe51efe2518589faa85))

## [0.4.0](https://github.com/datisthq/fireargs/compare/v0.3.0...v0.4.0) (2026-08-29)

### Features

- **landing:** add Datist attribution band ([28849df](https://github.com/datisthq/fireargs/commit/28849dfb05f42b997d854045fbd3b10a7f5f0b5c))

## [0.3.0](https://github.com/datisthq/fireargs/compare/v0.2.0...v0.3.0) (2026-04-30)

### Features

- --llms emits flat MCP tools/list shape (same for command + program) ([d3f4574](https://github.com/datisthq/fireargs/commit/d3f4574646c8f5408e07a657ca50b285655b1e8b))
- --llms manifest contains only JSON-relevant info ([dc018cd](https://github.com/datisthq/fireargs/commit/dc018cd8084d071d4b982a2ae333029f8bad1cda))
- accept commander config via createCommand(config) ([fa365d1](https://github.com/datisthq/fireargs/commit/fa365d1e1627b37eb58e065b5bc41166c4a4c9d0))
- add addHelpText/exitOverride/configureOutput/etc. to CommandConfig ([b1a3555](https://github.com/datisthq/fireargs/commit/b1a355572c6a023532ca795d03ad998df7ae6352))
- add commander hooks and configureHelp to CommandConfig ([82a5235](https://github.com/datisthq/fireargs/commit/82a5235775b04a32d070fdb7dfdf58591094a42c))
- add readme field to --llms manifest ([53ea131](https://github.com/datisthq/fireargs/commit/53ea131483a65a94c65830681316173d8e91a639))
- built-in --json [value] for JSON I/O mode (LLM-friendly) ([0e6022d](https://github.com/datisthq/fireargs/commit/0e6022dc2506dd9ca3ec39ce5f8beb2251562bfc))
- built-in --llms manifest for LLM tool-use ([ebb7774](https://github.com/datisthq/fireargs/commit/ebb77747e3025d6f2a9f46a2f253a31b22fd7367))
- command-creation API (f.command/f.argument) ([3c7cf02](https://github.com/datisthq/fireargs/commit/3c7cf021e7a7ef468c108f1587d804802b812684))
- compile chain to commander Command on .handler() ([2a4ebde](https://github.com/datisthq/fireargs/commit/2a4ebdebcb87b97ceb571f6cde104caa2b8570cf))
- derive choices, defaults, variadic, mandatory from zod ([f765656](https://github.com/datisthq/fireargs/commit/f76565603954983efe8a48d3b353c7607ba9728f))
- enrich --llms input schema with per-field fireargs metadata ([2b0c09a](https://github.com/datisthq/fireargs/commit/2b0c09a9537a92f3e6215146932fef0c593c73a8))
- f.program for subcommand trees with MCP-style --llms manifest ([a5f3281](https://github.com/datisthq/fireargs/commit/a5f32812c1a43f56d37184288e82648ecd59bf5b))
- nested programs compose recursively in --llms manifest ([5f77450](https://github.com/datisthq/fireargs/commit/5f774501dd231a7f7be6a5506012159d41a8888b))
- per-field config via createArgument()/createOption() builders ([cbb31e2](https://github.com/datisthq/fireargs/commit/cbb31e2a74823144d93a0810f121ed00da906c81))
- surface usage as a reserved _usage tool entry ([522f4ce](https://github.com/datisthq/fireargs/commit/522f4ce51a57e92843a2a9f9cf4ec30042cb768c))

## [0.2.0](https://github.com/datisthq/termway/compare/v0.1.0...v0.2.0) (2026-03-16)

### Features

- Added documentation website ([cd2620e](https://github.com/datisthq/termway/commit/cd2620e2600e48c2b0f72bf413bcc9c30c243821))
