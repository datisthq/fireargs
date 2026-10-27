# Changelog

## [0.6.2](https://github.com/datisthq/fireargs/compare/typescript-v0.6.1...typescript-v0.6.2) (2026-10-27)


### Bug Fixes

* correct doc and skill examples found in the bug hunt ([40b9de6](https://github.com/datisthq/fireargs/commit/40b9de69d96e97463e91ab4f68c621a622105f20))
* **llms:** name tools by their full path at every level in every twin ([08d90a5](https://github.com/datisthq/fireargs/commit/08d90a5f980acb3ea1e1d7b76eb6b7d437031167))
* **options:** read boolean env, add --no- flags and quote typed values in every twin ([ba2daac](https://github.com/datisthq/fireargs/commit/ba2daac47d62e3619c16633d1ce11b1b043fca2f))
* **program:** route bare programs, help and unknown commands alike in every twin ([8e14f73](https://github.com/datisthq/fireargs/commit/8e14f738b4febee6904782a8abf1ab12f799b075))
* **values:** type choices, tuples and numbers alike in every twin ([b6a6036](https://github.com/datisthq/fireargs/commit/b6a60362508fc8f4336b4df885629348e55b5a0b))

## [0.6.1](https://github.com/datisthq/fireargs/compare/v0.6.0...v0.6.1) (2026-10-27)


### Bug Fixes

* correct doc and skill examples found in the bug hunt ([40b9de6](https://github.com/datisthq/fireargs/commit/40b9de69d96e97463e91ab4f68c621a622105f20))
* **llms:** name tools by their full path at every level in every twin ([08d90a5](https://github.com/datisthq/fireargs/commit/08d90a5f980acb3ea1e1d7b76eb6b7d437031167))
* **options:** read boolean env, add --no- flags and quote typed values in every twin ([ba2daac](https://github.com/datisthq/fireargs/commit/ba2daac47d62e3619c16633d1ce11b1b043fca2f))
* **program:** route bare programs, help and unknown commands alike in every twin ([8e14f73](https://github.com/datisthq/fireargs/commit/8e14f738b4febee6904782a8abf1ab12f799b075))
* **values:** type choices, tuples and numbers alike in every twin ([b6a6036](https://github.com/datisthq/fireargs/commit/b6a60362508fc8f4336b4df885629348e55b5a0b))

## [0.6.0](https://github.com/datisthq/fireargs/compare/v0.5.0...v0.6.0) (2026-10-20)


### Features

* add a CLI-only parse to option and argument config ([1db9a03](https://github.com/datisthq/fireargs/commit/1db9a03435dc1dae9b7cc1b4b67dee509493ca6a))
* declare required positionals and report input errors like commander ([7f030c0](https://github.com/datisthq/fireargs/commit/7f030c0c624e1edb52211bd2087dc0ba7365ab36))
* derive kebab-case flags from input keys ([b407384](https://github.com/datisthq/fireargs/commit/b407384009db18396a0349be89e10a546a61508f))
* pass a handler context and render human output ([5b32751](https://github.com/datisthq/fireargs/commit/5b32751993725163f4781c7c87ff9a9deee794ed))

## [0.5.0](https://github.com/datisthq/fireargs/compare/v0.4.1...v0.5.0) (2026-10-20)


### Features

* add helpGroup to command and program config ([9ab8a6e](https://github.com/datisthq/fireargs/commit/9ab8a6e94a70c493ea47f2e23fe620805ff77b15)), closes [#3](https://github.com/datisthq/fireargs/issues/3)
* add program.router() and distinct Command/Program types ([96fb726](https://github.com/datisthq/fireargs/commit/96fb7263f536d219f90fe754be428913457d83e1)), closes [#2](https://github.com/datisthq/fireargs/issues/2)
* ship the fireargs-* agent skills in the package and on fireargs.dev ([a776f7e](https://github.com/datisthq/fireargs/commit/a776f7e4625ef666e9f1a7232fe8d79e9261a4e9))


### Bug Fixes

* make zod and commander peer dependencies ([3b82e16](https://github.com/datisthq/fireargs/commit/3b82e16912202e1c22c391681b11a3deaae1113a))

## [0.4.1](https://github.com/datisthq/fireargs/compare/v0.4.0...v0.4.1) (2026-10-06)


### Bug Fixes

* **ci:** look up the release PR instead of reading the action output ([e65ae41](https://github.com/datisthq/fireargs/commit/e65ae411cba89ce04775a1c31ddae2d9c443e0c4))

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
