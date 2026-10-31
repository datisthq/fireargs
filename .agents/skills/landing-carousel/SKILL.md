---
name: landing-carousel
description: Use when changing the landing page hero carousel — what the four terminal slides show, the demo CLI whose output they copy, and the layout rules around the source chip.
---

# Landing carousel

The landing page (`.livemark/routes/index.tsx`) has a two-column hero whose right side is a
carousel of **terminal transcripts**, each paired with a "Defined with a schema" source chip.
Each slide is a plain-text `terminal` string rendered and highlighted in code by
`highlightTerminal`, as on the irondocs landing: no images, so it follows the
theme and stays crisp.

| slide | shows                                                     | chip snippet                           |
| ----- | --------------------------------------------------------- | -------------------------------------- |
| Help  | `shipit deploy --help`                                    | the `env` argument and `region` option |
| JSON  | flags in / JSON out, JSON in / JSON out, a nested program | the `.output(z.object(...))` schema    |
| LLMs  | the `--llms` manifest queried with jq                     | `f.program(...).router(...)`           |
| Agent | an agent reading `--llms`, previewing, then deploying     | `.input(...)` and `.output(...)`       |

## Rules

- **Real output only.** Every line under a `$` prompt is pasted from running `shipit.ts`, the
  demo CLI next to this file, built with `f` from the repo source:
  `node .agents/skills/landing-carousel/shipit.ts deploy --help`. When the chip's snippet or
  the copy changes, change `shipit.ts` and re-paste. The agent slide's narration (`›`, `●`,
  `⎿` lines) is the only hand-written text, and it never names a product.
- **Soft-wrap long JSON by hand** at about 60 columns, as the agent slide does: from `lg` the
  window bleeds off the right edge of the viewport.
- **Leave room for the chip.** From `lg` the source chip overlaps the window's bottom-left, so
  `TerminalPanel` pads its bottom; the tallest slide sets the height for all of them. After a
  change, look at every slide at 1280 and 1440 px wide, in both themes, for text under the
  chip.
