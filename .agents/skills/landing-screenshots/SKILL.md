---
name: landing-screenshots
description: Use when changing the landing page hero carousel or regenerating its screenshots — what the four terminal slides show, the demo CLI behind them, the size and theme rules, and how to capture them.
---

# Landing screenshots

The landing page (`.livemark/routes/index.tsx`) mirrors livemark's own: a two-column hero
whose right side is a carousel of screenshots, each paired with a "Defined with a zod schema"
source chip. Fireargs is a CLI library, so the slides are **terminal sessions**, not pages of
this site:

| slide | shows                                                     | chip snippet                           |
| ----- | --------------------------------------------------------- | -------------------------------------- |
| Help  | `shipit deploy --help`                                    | the `env` argument and `region` option |
| JSON  | flags in / JSON out, JSON in / JSON out, a nested program | the `.output(z.object(...))` schema    |
| LLMs  | the `--llms` manifest queried with jq                     | `f.program(...).commands(...)`         |
| Agent | an agent reading `--llms`, previewing, then deploying     | `.input(...)` and `.output(...)`       |

## Rules

- **Real output only.** Every line under a `$` prompt comes from running `shipit.ts`, the demo
  CLI next to this file, built with `f` from the repo source. When the chip's snippet or the
  copy changes, change `shipit.ts` so the screenshot still matches it. The agent slide's
  narration is the only hand-written text, and it never names a product.
- **Keep content in the top-left ~68% × 66%.** From `lg` the window bleeds off the right edge
  of the viewport (as livemark's does), and the source chip covers the bottom-left. `render.ts`
  soft-wraps long JSON for this; check bounds after any change.
- **Match the site.** Light background `#ffffff`, dark `#0a0a0a` (the card colour), Catppuccin
  Latte/Mocha token colours, JetBrains Mono 13px with ligatures off.
- **Size.** 960×600 CSS px at device scale 2 → 1920×1200 webp, `<id>.webp` and
  `<id>-dark.webp` in `.livemark/public/screenshots/`.

## Regenerating

```bash
node .agents/skills/landing-screenshots/render.ts /tmp/slides
for f in /tmp/slides/*.html; do
  chromium --headless=new --hide-scrollbars --force-device-scale-factor=2 \
    --window-size=960,600 --virtual-time-budget=4000 \
    --screenshot="${f%.html}.png" "file://$f"
done
```

Then convert each PNG to webp (quality ~90), dropping the `-light` suffix. Chrome DevTools
MCP's `emulate` can fail to set the viewport; the headless CLI above is the reliable path.
Look at the hero afterwards at 1280 and 1440 px wide, in both themes.
