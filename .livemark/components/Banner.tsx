import { ArrowRight } from "lucide-react"

export function Banner() {
  return (
    <div className="bg-banner text-banner-foreground">
      {/* `relative` anchors the link's stretched `after:` box: the whole strip is one
          click target, and `group-hover` moves the arrow from anywhere on it. */}
      <div className="group relative mx-auto flex max-w-6xl items-center justify-center gap-2 px-4 py-2 text-center font-mono text-xs tracking-wide sm:px-6">
        <span className="min-w-0 truncate">Fireargs is in technical preview</span>
        <span aria-hidden className="hidden opacity-60 sm:inline">
          ·
        </span>
        <a
          href="https://github.com/datisthq/fireargs/discussions"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex shrink-0 items-center gap-1 no-underline after:absolute after:inset-0"
        >
          {/* `sr-only`, not `hidden`: on a phone the link would be left an unnamed icon. */}
          <span className="sr-only underline underline-offset-4 group-hover:no-underline sm:not-sr-only">
            Share feedback
          </span>
          <ArrowRight className="size-3 transition-transform group-hover:translate-x-0.5 group-active:translate-x-0.5 motion-reduce:transition-none" />
        </a>
      </div>
    </div>
  )
}
