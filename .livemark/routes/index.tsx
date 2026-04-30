import { Link, createFileRoute } from "@tanstack/react-router"
import {
  ArrowRight,
  Bot,
  Boxes,
  CheckCircle2,
  FileJson,
  Github,
  ShieldCheck,
  Terminal,
  Zap,
} from "lucide-react"
import type { ComponentType, ReactNode, SVGProps } from "react"
import { buttonVariants } from "livemark/elements/button"
import { useInView } from "livemark/hooks/in-view"
import { cn } from "livemark/utils/style"

export const Route = createFileRoute("/")({
  component: Landing,
})

function Landing() {
  return (
    <div className="flex flex-col">
      <Hero />
      <Features />
      <Showcase />
      <FinalCta />
    </div>
  )
}

function Hero() {
  return (
    <section className="relative overflow-hidden border-b border-border flex items-center min-h-[calc(100vh-4rem)]">
      <BackgroundGrid />
      <div className="relative w-full mx-auto max-w-5xl px-6 py-16 text-center animate-in fade-in-0 slide-in-from-bottom-4 duration-700 ease-out">
        <h1 className="text-5xl md:text-7xl font-extrabold tracking-tight text-foreground">
          CLI tools builder{" "}
          <span className="relative inline-block">
            <span className="relative z-10">for the new era</span>
            <span
              aria-hidden
              className="absolute left-0 right-0 bottom-1 md:bottom-2 h-3 md:h-4 bg-primary/20 -z-0 rounded"
            />
          </span>
        </h1>

        <p className="mt-6 text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto">
          Describe each command with a zod input/output schema and a handler.
          Fireargs hands you a fully-wired commander Command — with --help,
          --json, and --llms baked in.
        </p>

        <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-3">
          <Link
            to="/introduction/"
            className={cn(
              buttonVariants({ variant: "default", size: "lg" }),
              "px-5 no-underline",
            )}
          >
            Get started
            <ArrowRight className="size-4" />
          </Link>
          <a
            href="https://github.com/datisthq/fireargs"
            target="_blank"
            rel="noopener noreferrer"
            className={cn(
              buttonVariants({ variant: "outline", size: "lg" }),
              "px-5 no-underline",
            )}
          >
            <Github className="size-4" />
            View source
          </a>
        </div>

        <div className="mt-10 hidden sm:inline-flex items-center gap-3 rounded-lg border border-border bg-card/50 backdrop-blur px-4 py-2.5 font-mono text-sm text-muted-foreground">
          <span className="text-primary select-none">$</span>
          <span>
            <span className="text-foreground">npm install</span> fireargs zod
            commander
          </span>
        </div>
      </div>
    </section>
  )
}

function BackgroundGrid() {
  return (
    <>
      <div
        aria-hidden
        className="absolute inset-0 [background-image:repeating-linear-gradient(90deg,var(--color-border)_0,var(--color-border)_1px,transparent_1px,transparent_8px)] opacity-25 [mask-image:linear-gradient(to_top,black_10%,transparent_85%)]"
      />
      <div
        aria-hidden
        className="absolute -bottom-40 -left-40 h-[36rem] w-[36rem] rounded-full bg-primary/30 dark:bg-primary/25 blur-[110px] pointer-events-none"
      />
      <div
        aria-hidden
        className="absolute -top-32 -right-32 h-[32rem] w-[32rem] rounded-full bg-amber-400/25 dark:bg-amber-500/20 blur-[110px] pointer-events-none"
      />
    </>
  )
}

interface Feature {
  icon: ComponentType<SVGProps<SVGSVGElement>>
  title: string
  description: string
}

const features: Feature[] = [
  {
    icon: Zap,
    title: "Schema-first",
    description:
      "Inputs and outputs are zod schemas. Descriptions, defaults, choices, and variadics propagate to commander automatically.",
  },
  {
    icon: ShieldCheck,
    title: "Validated end-to-end",
    description:
      "Zod validates every input before your handler runs and every output before it ships. One source of truth for types and runtime.",
  },
  {
    icon: FileJson,
    title: "Built-in --json",
    description:
      "Every command takes JSON in and emits JSON out via --json. Drive it from a script, a pipeline, or another agent — same binary.",
  },
  {
    icon: Bot,
    title: "Built-in --llms",
    description:
      "Each binary publishes an MCP-shaped tools/list manifest. LLM agents read it and call straight back through --json.",
  },
  {
    icon: Boxes,
    title: "Composable trees",
    description:
      "Group leaves into programs, nest programs inside programs. The same builder shape works at every level.",
  },
  {
    icon: Terminal,
    title: "Powered by Commander",
    description:
      "The thing you get back is a commander Command. Every commander API stays available — fireargs just fills in the boring parts.",
  },
]

function Features() {
  return (
    <section className="border-b border-border">
      <div className="mx-auto max-w-6xl px-6 py-24">
        <Reveal>
          <div className="text-center max-w-2xl mx-auto mb-16">
            <h2 className="text-3xl md:text-4xl font-bold tracking-tight">
              From schema to shipping CLI
            </h2>
            <p className="mt-4 text-muted-foreground text-lg">
              Sane defaults, every escape hatch, no extra plumbing.
            </p>
          </div>
        </Reveal>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {features.map((f, i) => (
            <Reveal key={f.title} delayMs={i * 60}>
              <FeatureCard {...f} />
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  )
}

function FeatureCard({ icon: Icon, title, description }: Feature) {
  return (
    <div className="h-full group relative rounded-xl border border-border bg-card p-6 transition-all duration-200 hover:border-primary/40 hover:-translate-y-0.5 hover:shadow-lg">
      <div className="inline-flex items-center justify-center size-10 rounded-lg bg-primary/10 text-primary mb-4 group-hover:bg-primary/15 transition-colors">
        <Icon className="size-5" />
      </div>
      <h3 className="text-lg font-semibold text-foreground">{title}</h3>
      <p className="mt-2 text-sm text-muted-foreground leading-relaxed">
        {description}
      </p>
    </div>
  )
}

const tk = {
  comment: "text-[#9ca0b0] dark:text-[#6c7086]",
  keyword: "text-[#8839ef] dark:text-[#cba6f7]",
  type: "text-[#df8e1d] dark:text-[#f9e2af]",
  string: "text-[#40a02b] dark:text-[#a6e3a1]",
  func: "text-[#1e66f5] dark:text-[#89b4fa]",
  punct: "text-[#7c7f93] dark:text-[#9399b2]",
  body: "text-[#4c4f69] dark:text-[#cdd6f4]",
  dim: "text-[#9ca0b0] dark:text-[#6c7086]",
  flag: "text-[#179299] dark:text-[#94e2d5]",
  prompt: "text-[#d20f39] dark:text-[#f38ba8]",
  key: "text-[#1e66f5] dark:text-[#89b4fa]",
}

function SourceSample() {
  return (
    <pre className="p-5 text-sm leading-relaxed font-mono overflow-x-auto">
      <code className={tk.body}>
        <span className={tk.keyword}>import</span>{" "}
        <span className={tk.punct}>{"{ "}</span>f
        <span className={tk.punct}>{" }"}</span>{" "}
        <span className={tk.keyword}>from</span>{" "}
        <span className={tk.string}>"fireargs"</span>
        {"\n"}
        <span className={tk.keyword}>import</span>{" "}
        <span className={tk.punct}>{"{ "}</span>z
        <span className={tk.punct}>{" }"}</span>{" "}
        <span className={tk.keyword}>from</span>{" "}
        <span className={tk.string}>"zod"</span>
        {"\n\n"}
        <span className={tk.keyword}>const</span> greet{" "}
        <span className={tk.punct}>=</span> f{"\n  "}
        <span className={tk.punct}>.</span>
        <span className={tk.func}>command</span>
        <span className={tk.punct}>{"({ "}</span>name
        <span className={tk.punct}>:</span>{" "}
        <span className={tk.string}>"greet"</span>
        <span className={tk.punct}>{" })"}</span>
        {"\n  "}
        <span className={tk.punct}>.</span>
        <span className={tk.func}>input</span>
        <span className={tk.punct}>(</span>z<span className={tk.punct}>.</span>
        <span className={tk.func}>object</span>
        <span className={tk.punct}>{"({"}</span>
        {"\n    "}
        name<span className={tk.punct}>:</span> f
        <span className={tk.punct}>.</span>
        <span className={tk.func}>argument</span>
        <span className={tk.punct}>().</span>
        <span className={tk.func}>string</span>
        <span className={tk.punct}>(),</span>
        {"\n    "}
        times<span className={tk.punct}>:</span> z
        <span className={tk.punct}>.</span>
        <span className={tk.func}>number</span>
        <span className={tk.punct}>().</span>
        <span className={tk.func}>default</span>
        <span className={tk.punct}>(</span>
        <span className={tk.type}>1</span>
        <span className={tk.punct}>),</span>
        {"\n  "}
        <span className={tk.punct}>{"})) "}</span>
        {"\n  "}
        <span className={tk.punct}>.</span>
        <span className={tk.func}>output</span>
        <span className={tk.punct}>(</span>z<span className={tk.punct}>.</span>
        <span className={tk.func}>object</span>
        <span className={tk.punct}>{"({ "}</span>
        greeting<span className={tk.punct}>:</span> z
        <span className={tk.punct}>.</span>
        <span className={tk.func}>string</span>
        <span className={tk.punct}>{"() })) "}</span>
        {"\n  "}
        <span className={tk.punct}>.</span>
        <span className={tk.func}>handler</span>
        <span className={tk.punct}>(</span>input{" "}
        <span className={tk.punct}>{"=> ({"}</span>
        {"\n    "}
        greeting<span className={tk.punct}>:</span>{" "}
        <span className={tk.string}>{"`hello ${input.name}`"}</span>
        <span className={tk.punct}>.</span>
        <span className={tk.func}>repeat</span>
        <span className={tk.punct}>(</span>input
        <span className={tk.punct}>.</span>times
        <span className={tk.punct}>),</span>
        {"\n  "}
        <span className={tk.punct}>{"}))"}</span>
        {"\n\n"}
        greet<span className={tk.punct}>.</span>
        <span className={tk.func}>parseAsync</span>
        <span className={tk.punct}>(</span>process
        <span className={tk.punct}>.</span>argv
        <span className={tk.punct}>)</span>
      </code>
    </pre>
  )
}

function ManifestSample() {
  return (
    <pre className="p-5 text-sm leading-relaxed font-mono overflow-x-auto">
      <code className={tk.body}>
        <span className={tk.prompt}>$</span>{" "}
        <span className={tk.func}>greet</span>{" "}
        <span className={tk.flag}>--llms</span>
        {"\n"}
        <span className={tk.punct}>{"{"}</span>
        {"\n  "}
        <span className={tk.key}>"tools"</span>
        <span className={tk.punct}>: [</span>
        {"\n    "}
        <span className={tk.punct}>{"{ "}</span>
        <span className={tk.key}>"name"</span>
        <span className={tk.punct}>:</span>{" "}
        <span className={tk.string}>"help"</span>
        <span className={tk.punct}>,</span> <span className={tk.dim}>...</span>
        <span className={tk.punct}>{" }, "}</span>
        {"\n    "}
        <span className={tk.punct}>{"{"}</span>
        {"\n      "}
        <span className={tk.key}>"name"</span>
        <span className={tk.punct}>:</span>{" "}
        <span className={tk.string}>"greet"</span>
        <span className={tk.punct}>,</span>
        {"\n      "}
        <span className={tk.key}>"description"</span>
        <span className={tk.punct}>:</span>{" "}
        <span className={tk.string}>"Greet someone politely"</span>
        <span className={tk.punct}>,</span>
        {"\n      "}
        <span className={tk.key}>"inputSchema"</span>
        <span className={tk.punct}>:</span>{" "}
        <span className={tk.punct}>{"{ "}</span>
        <span className={tk.key}>"type"</span>
        <span className={tk.punct}>:</span>{" "}
        <span className={tk.string}>"object"</span>
        <span className={tk.punct}>,</span> <span className={tk.dim}>...</span>
        <span className={tk.punct}>{" }"}</span>
        <span className={tk.punct}>,</span>
        {"\n      "}
        <span className={tk.key}>"outputSchema"</span>
        <span className={tk.punct}>:</span>{" "}
        <span className={tk.punct}>{"{ "}</span>
        <span className={tk.key}>"type"</span>
        <span className={tk.punct}>:</span>{" "}
        <span className={tk.string}>"object"</span>
        <span className={tk.punct}>,</span> <span className={tk.dim}>...</span>
        <span className={tk.punct}>{" }"}</span>
        {"\n    "}
        <span className={tk.punct}>{"}"}</span>
        {"\n  "}
        <span className={tk.punct}>]</span>
        {"\n"}
        <span className={tk.punct}>{"}"}</span>
        {"\n"}
      </code>
    </pre>
  )
}

function Showcase() {
  return (
    <section className="border-b border-border bg-primary/5">
      <div className="mx-auto max-w-6xl px-6 py-24">
        <Reveal>
          <div className="text-center max-w-2xl mx-auto mb-16">
            <h2 className="text-3xl md:text-4xl font-bold tracking-tight">
              One schema, every interface
            </h2>
            <p className="mt-4 text-muted-foreground text-lg">
              The same zod schema drives{" "}
              <code className="font-mono">--help</code>,{" "}
              <code className="font-mono">--json</code>, and the LLM manifest.
            </p>
          </div>
        </Reveal>
        <Reveal>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
            <div className="rounded-xl border border-primary/20 bg-card overflow-hidden">
              <div className="flex items-center gap-2 border-b border-primary/20 px-4 py-2 bg-muted/50">
                <div className="size-2.5 rounded-full bg-red-400/60" />
                <div className="size-2.5 rounded-full bg-yellow-400/60" />
                <div className="size-2.5 rounded-full bg-green-400/60" />
                <span className="ml-2 text-xs font-mono text-muted-foreground">
                  greet.ts
                </span>
              </div>
              <SourceSample />
            </div>
            <div className="rounded-xl border border-primary/20 bg-card overflow-hidden">
              <div className="flex items-center gap-2 border-b border-primary/20 px-4 py-2 bg-muted/50">
                <div className="size-2.5 rounded-full bg-red-400/60" />
                <div className="size-2.5 rounded-full bg-yellow-400/60" />
                <div className="size-2.5 rounded-full bg-green-400/60" />
                <span className="ml-2 text-xs font-mono text-muted-foreground">
                  greet --llms
                </span>
              </div>
              <ManifestSample />
            </div>
          </div>
        </Reveal>
        <Reveal delayMs={120}>
          <div className="mt-10 grid grid-cols-1 md:grid-cols-3 gap-4">
            <Bullet text="JSDoc descriptions surface in --help and the JSON Schema." />
            <Bullet text="Defaults, choices, and optionality flow to commander automatically." />
            <Bullet text="Every leaf gets --json '<value>' and --llms for free." />
          </div>
        </Reveal>
      </div>
    </section>
  )
}

function Bullet({ text }: { text: string }) {
  return (
    <div className="flex items-start gap-3 rounded-lg border border-primary/20 bg-card/60 p-4">
      <CheckCircle2 className="size-5 text-primary shrink-0 mt-0.5" />
      <p className="text-sm text-foreground/90 leading-relaxed">{text}</p>
    </div>
  )
}

function FinalCta() {
  return (
    <section className="relative overflow-hidden">
      <div className="relative mx-auto max-w-3xl px-6 py-24 text-center">
        <Reveal>
          <h2 className="text-3xl md:text-5xl font-extrabold tracking-tight">
            Stop hand-rolling argument parsers.{" "}
            <span className="text-primary">Write a schema.</span>
          </h2>
          <p className="mt-6 text-lg text-muted-foreground">
            Install, write a command, ship a CLI that humans, scripts, and LLMs
            can all call.
          </p>
          <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-3">
            <Link
              to="/introduction/"
              className={cn(
                buttonVariants({ variant: "default", size: "lg" }),
                "px-5 no-underline",
              )}
            >
              Read the docs
              <ArrowRight className="size-4" />
            </Link>
            <Link
              to="/llms-mode/"
              className={cn(
                buttonVariants({ variant: "ghost", size: "lg" }),
                "px-5 no-underline",
              )}
            >
              See LLMs mode
            </Link>
          </div>
        </Reveal>
      </div>
    </section>
  )
}

function Reveal(props: { children: ReactNode; delayMs?: number }) {
  const { ref, isVisible } = useInView()
  return (
    <div
      ref={ref as (node: HTMLDivElement | null) => void}
      style={{ transitionDelay: `${props.delayMs ?? 0}ms` }}
      className={cn(
        "transition-all duration-700 ease-out",
        isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4",
      )}
    >
      {props.children}
    </div>
  )
}
