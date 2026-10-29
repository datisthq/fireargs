# Changelog

## [0.1.2](https://github.com/datisthq/fireargs/compare/python-v0.1.1...python-v0.1.2) (2026-10-29)


### Bug Fixes

* **python:** name a missing aliased option by its flag ([e0a0b0e](https://github.com/datisthq/fireargs/commit/e0a0b0eed6e6e9f073c2e62ee025c80893edbe4f))

## [0.1.1](https://github.com/datisthq/fireargs/compare/python-v0.1.0...python-v0.1.1) (2026-10-27)


### Bug Fixes

* correct doc and skill examples found in the bug hunt ([40b9de6](https://github.com/datisthq/fireargs/commit/40b9de69d96e97463e91ab4f68c621a622105f20))
* **llms:** name tools by their full path at every level in every twin ([08d90a5](https://github.com/datisthq/fireargs/commit/08d90a5f980acb3ea1e1d7b76eb6b7d437031167))
* **options:** read boolean env, add --no- flags and quote typed values in every twin ([ba2daac](https://github.com/datisthq/fireargs/commit/ba2daac47d62e3619c16633d1ce11b1b043fca2f))
* **program:** route bare programs, help and unknown commands alike in every twin ([8e14f73](https://github.com/datisthq/fireargs/commit/8e14f738b4febee6904782a8abf1ab12f799b075))
* **python:** keep only pydantic's own reasons on a hide_input error ([efb62f4](https://github.com/datisthq/fireargs/commit/efb62f4e6facd8211be58aad15b3632f41b4fe74))
* **values:** type choices, tuples and numbers alike in every twin ([b6a6036](https://github.com/datisthq/fireargs/commit/b6a60362508fc8f4336b4df885629348e55b5a0b))

## 0.1.0 (2026-10-21)


### Features

* add the Python package built on click and pydantic ([8e545e0](https://github.com/datisthq/fireargs/commit/8e545e0b46e13a3f98a02ac53571caa31890740e))
* let Python renders and render_error hooks skip the context parameter ([535a43f](https://github.com/datisthq/fireargs/commit/535a43f30742107b5b147b4ab85f243519d1a82c))


### Documentation

* add a JSON mode section before LLMs mode in both READMEs ([216fc7f](https://github.com/datisthq/fireargs/commit/216fc7fba31a2e1438c6f5fa61017f6842553132))
* allow 100-column code snippets and guard the limit ([0ade43c](https://github.com/datisthq/fireargs/commit/0ade43cfc8f6673697c7fe4b423d2bd64f37252c))
* carry defaults in Python field definitions ([1737335](https://github.com/datisthq/fireargs/commit/173733522eb64c5d88dead0f8a2ce6010084f2cd))
* comment the program examples like the first ones ([e37c543](https://github.com/datisthq/fireargs/commit/e37c5432ebd20e5584ac1e8a1c1635e1e7641092))
* describe the audience as humans, agents, and scripts everywhere ([471e3e1](https://github.com/datisthq/fireargs/commit/471e3e1725efe0aa52200d84ebc41210ecec0ea3))
* extract Python field aliases in snippets and keep imports together ([2d179ae](https://github.com/datisthq/fireargs/commit/2d179ae3eaf00d926cdaf53f80aef640a46fcb56))
* format Markdown snippets at 100 columns and keep field definitions on one line ([080cef4](https://github.com/datisthq/fireargs/commit/080cef43f786c63a03b8692b0070a65205de8ec0))
* give JSON mode an icon lucide still knows ([3f42cef](https://github.com/datisthq/fireargs/commit/3f42cef7669e4c503975cf8d5dd8d969a17c0189))
* highlight the features in the first examples with comments ([e816f6a](https://github.com/datisthq/fireargs/commit/e816f6a328b442e072b850dc2a135d2680a748fe))
* import fireargs as fa in the Python docs ([3b67e5d](https://github.com/datisthq/fireargs/commit/3b67e5d015620324d7406f9303f59e0cdf10680a))
* import names from fireargs directly in the Python docs ([40fe430](https://github.com/datisthq/fireargs/commit/40fe430c6b644aa6531e42f4a6cccf95e976253f))
* list each package's changelog last in its own section ([805b087](https://github.com/datisthq/fireargs/commit/805b0872fbe2bff9731860e2ada9500eac998e11))
* list Python first, give each section its Contributing page, drop Project ([3bfe7d0](https://github.com/datisthq/fireargs/commit/3bfe7d0b4b932223ebd14576c9963c4f680ec596))
* make the landing page bilingual with a Python and TypeScript switch ([09fa81a](https://github.com/datisthq/fireargs/commit/09fa81a9120b8e54d9fb29c882797f065c8671af))
* mention configuring on the examples' run lines ([5760f36](https://github.com/datisthq/fireargs/commit/5760f364fa8f3dedeb67c0023f938293ce111f90))
* mention plugins on the first examples' run lines ([1de7e88](https://github.com/datisthq/fireargs/commit/1de7e88480ea89775c3f7a6e22a8e228e4c72398))
* note the first examples run as plain click and commander commands ([714f458](https://github.com/datisthq/fireargs/commit/714f4580a50e7f376d9eb743e58c8d1042c93b30))
* return a list of greetings so JSON output shows more ([f34a350](https://github.com/datisthq/fireargs/commit/f34a350f986abe5d245058ee779bc1c9210935f4))
* return one greeting again and restore the jq JSON mode examples ([25f5805](https://github.com/datisthq/fireargs/commit/25f58055845e00cbb0f5e7be8c333f7e5b393c95))
* show a program's help and a nested call in both READMEs ([04040f0](https://github.com/datisthq/fireargs/commit/04040f085463559ef0d3610145e5718beda791eb))
* show fuller JSON mode output in both READMEs ([09a81ac](https://github.com/datisthq/fireargs/commit/09a81aca328284526e0e1c9f1a7437854c8eb5b8))
* title the README install sections Installation ([ee6e934](https://github.com/datisthq/fireargs/commit/ee6e934a849d869a4e86c28a86a91526ad9e941a))
* title the README program sections A first program ([93e8a92](https://github.com/datisthq/fireargs/commit/93e8a92a889640482cc4693cdf2956cb19027cdb))
* trim JSON mode to one JSON call in both READMEs ([2af5244](https://github.com/datisthq/fireargs/commit/2af524432520ff4a94d1822dc3b59f31d2d637ac))

## Changelog
