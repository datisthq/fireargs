import { MessageCircle, Star } from "lucide-react"

/** Technical preview banner displayed in the header */
export function Banner() {
  return (
    <div className="hidden md:flex flex-1 items-center justify-end">
      <div className="rounded-xl border border-primary/20 bg-primary/2 dark:bg-primary/5 shadow-xs px-3 py-1.5 text-sm text-primary">
        <span>
          This project is in technical preview.{" "}
          <a
            href="https://github.com/datisthq/fireargs"
            target="_blank"
            rel="noopener noreferrer"
            className="font-semibold hover:underline underline-offset-2"
          >
            <Star className="inline size-3.5 align-[-0.125em]" /> Star on GitHub
          </a>{" "}
          and{" "}
          <a
            href="https://github.com/datisthq/fireargs/discussions"
            target="_blank"
            rel="noopener noreferrer"
            className="font-semibold hover:underline underline-offset-2"
          >
            <MessageCircle className="inline size-3.5 align-[-0.125em]" /> share
            feedback!
          </a>
        </span>
      </div>
    </div>
  )
}
