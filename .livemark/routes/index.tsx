import { Link, createFileRoute } from "@tanstack/react-router"
import {
  BookOpen,
  Bot,
  Boxes,
  CheckCircle2,
  FileJson,
  Github,
  Layers,
  Network,
  Rocket,
  ShieldCheck,
  SquareTerminal,
  Terminal,
  Zap,
} from "lucide-react"
import {
  type ComponentType,
  type ReactNode,
  type SVGProps,
  createContext,
  useContext,
  useRef,
  useState,
} from "react"
import { BackToTop } from "livemark/components/BackToTop"
import { Banner } from "livemark/components/Banner"
import { Header } from "livemark/components/Header"
import { buttonVariants } from "livemark/elements/button"
import { useInView } from "livemark/hooks/in-view"
import { cn } from "cn"

export const Route = createFileRoute("/")({
  component: Landing,
})

function Landing() {
  const [lang, setLang] = useState<Lang>("python")
  return (
    <LangContext.Provider value={{ lang, setLang }}>
      <Banner />
      <Header />
      <main className="flex flex-col">
        <Hero />
        <Freedom />
        <Features />
        <Showcase />
        <FinalCta />
        <Datist />
      </main>
      <BackToTop />
    </LangContext.Provider>
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

type Lang = "python" | "typescript"

const langIds: Lang[] = ["python", "typescript"]

const langs: Record<
  Lang,
  { label: string; models: string; schema: string; cli: string; file: string }
> = {
  python: {
    label: "Python",
    models: "models",
    schema: "pydantic",
    cli: "click",
    file: "greet.py",
  },
  typescript: {
    label: "TypeScript",
    models: "schemas",
    schema: "zod",
    cli: "commander",
    file: "greet.ts",
  },
}

const LangContext = createContext<{ lang: Lang; setLang: (lang: Lang) => void }>({
  lang: "python",
  setLang: () => {},
})

function useLang() {
  return useContext(LangContext)
}

function LangTabs() {
  const { lang, setLang } = useLang()
  return (
    <div
      role="tablist"
      aria-label="Language"
      className="inline-flex gap-1 rounded-control border border-border bg-card p-1"
    >
      {langIds.map(id => (
        <button
          key={id}
          type="button"
          role="tab"
          aria-selected={lang === id}
          onClick={() => setLang(id)}
          className={cn(
            "rounded-md px-3 py-1 text-sm font-medium transition-colors",
            lang === id
              ? "bg-primary text-primary-foreground"
              : "text-muted-foreground hover:text-foreground",
          )}
        >
          {langs[id].label}
        </button>
      ))}
    </div>
  )
}

const keywords: Record<Lang, Set<string>> = {
  python: new Set(["from", "import", "class", "def", "return", "if", "async", "await"]),
  typescript: new Set(["import", "from", "const", "return", "async", "await", "new"]),
}

const TOKEN =
  /(#.*|\/\/.*)|(f?"(?:[^"\\]|\\.)*"|`(?:[^`\\]|\\.)*`)|(@\w+)|(\b\d+\b)|([A-Za-z_]\w*)|([^\sA-Za-z_\d"`#@]+)|(\s+)|([\s\S])/g

function highlightCode(code: string, lang: Lang) {
  return [...code.matchAll(TOKEN)].map(match => {
    const [text, comment, string, decorator, number, word, punct] = match
    const next = code[match.index + text.length]
    const className = comment
      ? tk.comment
      : string
        ? tk.string
        : decorator
          ? tk.func
          : number
            ? tk.type
            : word
              ? readWordClass(word, next, lang)
              : punct
                ? tk.punct
                : undefined
    return className ? (
      <span key={match.index} className={className}>
        {text}
      </span>
    ) : (
      text
    )
  })
}

function readWordClass(word: string, next: string | undefined, lang: Lang) {
  if (keywords[lang].has(word)) return tk.keyword
  if (next === "(") return tk.func
  if (/^[A-Z]/.test(word)) return tk.type
  return undefined
}

function Hero() {
  return (
    <section className="relative overflow-hidden border-b border-border">
      <BackgroundGrid />
      <div className="relative mx-auto w-full max-w-6xl px-6 py-20 md:py-28 lg:grid lg:grid-cols-[27rem_minmax(0,1fr)] lg:items-center lg:gap-14">
        <div className="animate-in fade-in-0 slide-in-from-bottom-4 duration-700 ease-out">
          <p className="text-primary text-xs font-semibold tracking-[0.18em] uppercase">
            For Python and TypeScript
          </p>
          <h1 className="mt-5 text-4xl font-semibold tracking-tight text-foreground sm:text-5xl md:text-6xl lg:text-5xl">
            Typed CLIs for
            <br />
            <span className="box-decoration-clone bg-linear-to-r from-primary/20 to-primary/20 bg-size-[100%_0.3em] bg-position-[0_88%] bg-no-repeat">
              humans, agents
              <br />
              and scripts.
            </span>
          </h1>
          <p className="mt-6 max-w-[52ch] text-lg leading-relaxed text-muted-foreground md:text-xl">
            Define each command with an input and an output schema. Get{" "}
            <code className="font-mono whitespace-nowrap text-foreground">
              --help
            </code>{" "}
            for humans, an MCP-shaped{" "}
            <code className="font-mono whitespace-nowrap text-foreground">--llms</code>{" "}
            manifest for agents and{" "}
            <code className="font-mono whitespace-nowrap text-foreground">--json</code>{" "}
            for scripts, all from one definition.
          </p>
          <HeroActions />
        </div>
        <div className="mt-12 lg:mt-0 xl:w-[60rem] animate-in fade-in-0 slide-in-from-bottom-4 duration-700 ease-out">
          <HeroCarousel slides={slides} />
        </div>
      </div>
    </section>
  )
}

function HeroActions() {
  const { lang } = useLang()
  return (
    <>
      <div className="mt-10 flex flex-wrap gap-3">
        <Link
          to="/$"
          params={{ _splat: `${lang}/introduction` }}
          className={cn(
            buttonVariants({ variant: "default", size: "lg" }),
            "px-5 no-underline",
          )}
        >
          <Rocket className="size-4" />
          Get started
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
      <div className="mt-6 hidden sm:inline-grid grid-cols-[auto_auto] gap-x-3 gap-y-1 rounded-control border border-border bg-card/50 backdrop-blur px-4 py-2 font-mono text-sm text-muted-foreground">
        <span className="text-primary select-none">$</span>
        <span>
          <span className="text-foreground">pip install</span> fireargs
        </span>
        <span className="text-primary select-none">$</span>
        <span>
          <span className="text-foreground">npm install</span> fireargs
        </span>
      </div>
    </>
  )
}

interface Shot {
  src: string
  srcDark: string
  alt: string
}

interface Slide {
  id: string
  title: string
  shot: Shot
  source: { file: string; code: ReactNode }
}

const slides: Slide[] = [
  {
    id: "help",
    title: "Help",
    shot: {
      src: "/screenshots/help.webp",
      srcDark: "/screenshots/help-dark.webp",
      alt: "The --help output of a fireargs command, with an argument, its choices, short flags, defaults and an env fallback",
    },
    source: {
      file: "deploy.ts",
      code: (
        <>
          env<span className={tk.punct}>:</span> f<span className={tk.punct}>.</span>
          <span className={tk.func}>argument</span>
          <span className={tk.punct}>().</span>
          <span className={tk.func}>enum</span>
          <span className={tk.punct}>(</span>envs<span className={tk.punct}>),</span>
          {"\n"}
          region<span className={tk.punct}>:</span> f<span className={tk.punct}>.</span>
          <span className={tk.func}>option</span>
          <span className={tk.punct}>{"({ "}</span>short
          <span className={tk.punct}>:</span> <span className={tk.string}>"r"</span>
          <span className={tk.punct}>{" })"}</span>
        </>
      ),
    },
  },
  {
    id: "json",
    title: "JSON",
    shot: {
      src: "/screenshots/json.webp",
      srcDark: "/screenshots/json-dark.webp",
      alt: "Commands run with --json, taking flags or a JSON object as input and printing validated JSON output",
    },
    source: {
      file: "deploy.ts",
      code: (
        <>
          <span className={tk.punct}>.</span>
          <span className={tk.func}>output</span>
          <span className={tk.punct}>(</span>z<span className={tk.punct}>.</span>
          <span className={tk.func}>object</span>
          <span className={tk.punct}>{"({"}</span>
          {"\n  "}
          url<span className={tk.punct}>:</span> z<span className={tk.punct}>.</span>
          <span className={tk.func}>string</span>
          <span className={tk.punct}>(),</span>
          {"\n  "}
          status<span className={tk.punct}>:</span> z<span className={tk.punct}>.</span>
          <span className={tk.func}>enum</span>
          <span className={tk.punct}>([</span>
          <span className={tk.string}>"live"</span>
          <span className={tk.punct}>, </span>
          <span className={tk.string}>"planned"</span>
          <span className={tk.punct}>]),</span>
          {"\n"}
          <span className={tk.punct}>{"}))"}</span>
        </>
      ),
    },
  },
  {
    id: "llms",
    title: "LLMs",
    shot: {
      src: "/screenshots/llms.webp",
      srcDark: "/screenshots/llms-dark.webp",
      alt: "The --llms manifest queried with jq, listing the tools and the JSON Schema of an input field",
    },
    source: {
      file: "cli.ts",
      code: (
        <>
          f<span className={tk.punct}>.</span>
          <span className={tk.func}>program</span>
          <span className={tk.punct}>{"({ "}</span>name<span className={tk.punct}>:</span>{" "}
          <span className={tk.string}>"shipit"</span>
          <span className={tk.punct}>{" })"}</span>
          {"\n  "}
          <span className={tk.punct}>.</span>
          <span className={tk.func}>router</span>
          <span className={tk.punct}>{"({ "}</span>deploy
          <span className={tk.punct}>,</span> db <span className={tk.punct}>{"})"}</span>
        </>
      ),
    },
  },
  {
    id: "agent",
    title: "Agent",
    shot: {
      src: "/screenshots/agent.webp",
      srcDark: "/screenshots/agent-dark.webp",
      alt: "An agent reading the --llms manifest, previewing a deploy through --json and then running it",
    },
    source: {
      file: "deploy.ts",
      code: (
        <>
          <span className={tk.punct}>.</span>
          <span className={tk.func}>input</span>
          <span className={tk.punct}>(</span>z<span className={tk.punct}>.</span>
          <span className={tk.func}>object</span>
          <span className={tk.punct}>{"({ "}</span>env<span className={tk.punct}>,</span>{" "}
          region<span className={tk.punct}>,</span> preview{" "}
          <span className={tk.punct}>{"}))"}</span>
          {"\n"}
          <span className={tk.punct}>.</span>
          <span className={tk.func}>output</span>
          <span className={tk.punct}>(</span>z<span className={tk.punct}>.</span>
          <span className={tk.func}>object</span>
          <span className={tk.punct}>{"({ "}</span>url<span className={tk.punct}>,</span>{" "}
          status <span className={tk.punct}>{"}))"}</span>
        </>
      ),
    },
  },
]

function HeroCarousel(props: { slides: Slide[] }) {
  const [active, setActive] = useState(0)
  const [paused, setPaused] = useState(false)
  const [stopped, setStopped] = useState(false)
  const stoppedRef = useRef(false)

  return (
    <div
      className="relative"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={() => setPaused(false)}
    >
      <figure className="overflow-hidden rounded-card border border-border bg-card shadow-xl">
        <div className="flex items-center gap-5 border-b border-border bg-muted/50 px-4 py-2">
          <span aria-hidden className="hidden gap-1.5 sm:flex">
            <span className="size-2.5 rounded-full bg-border" />
            <span className="size-2.5 rounded-full bg-border" />
            <span className="size-2.5 rounded-full bg-border" />
          </span>
          <div role="tablist" className="flex min-w-0 gap-1">
            {props.slides.map((slide, index) => (
              <button
                key={slide.id}
                type="button"
                role="tab"
                aria-selected={index === active}
                aria-controls={`hero-slide-${slide.id}`}
                onClick={() => {
                  stoppedRef.current = true
                  setActive(index)
                  setStopped(true)
                }}
                className={cn(
                  "relative flex cursor-pointer items-center gap-2 overflow-hidden rounded-control px-3 py-1.5 text-sm whitespace-nowrap transition-colors",
                  index === active
                    ? "bg-card font-medium text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                <span
                  className={cn("font-mono text-xs", index === active && "text-primary")}
                >
                  {String(index + 1).padStart(2, "0")}
                </span>
                <span className={index === active ? undefined : "hidden sm:inline"}>
                  {slide.title}
                </span>
                {index === active ? (
                  <span
                    key={stopped ? "stopped" : active}
                    aria-hidden
                    className={cn(
                      "absolute inset-x-3 bottom-0.5 h-0.5 rounded-full bg-primary/70",
                      !stopped && "hero-carousel-progress",
                    )}
                    style={{ animationPlayState: paused ? "paused" : "running" }}
                    onAnimationEnd={() => {
                      if (stoppedRef.current) return
                      setActive(current => (current + 1) % props.slides.length)
                    }}
                  />
                ) : null}
              </button>
            ))}
          </div>
        </div>
        <div className="grid">
          {props.slides.map((slide, index) => (
            <div
              key={slide.id}
              id={`hero-slide-${slide.id}`}
              role="tabpanel"
              aria-hidden={index !== active}
              className={cn(
                "[grid-area:1/1] transition-opacity duration-700 motion-reduce:transition-none",
                index === active ? "opacity-100" : "pointer-events-none opacity-0",
              )}
            >
              <ShotPicture shot={slide.shot} className="aspect-[16/10] w-full" />
            </div>
          ))}
        </div>
      </figure>
      <div className="mt-4 grid lg:absolute lg:-bottom-10 lg:-left-10 lg:mt-0 lg:w-[24rem]">
        {props.slides.map((slide, index) => (
          <div
            key={slide.id}
            aria-hidden={index !== active}
            inert={index !== active}
            className={cn(
              "[grid-area:1/1] transition-opacity duration-700 motion-reduce:transition-none",
              index === active ? "opacity-100" : "pointer-events-none opacity-0",
            )}
          >
            <SourceChip source={slide.source} />
          </div>
        ))}
      </div>
    </div>
  )
}

function SourceChip(props: { source: Slide["source"] }) {
  return (
    <figure className="flex h-full gap-3 rounded-card border border-primary/25 bg-card p-4 shadow-lg">
      <span className="flex size-8 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
        <SquareTerminal className="size-4" />
      </span>
      <div className="min-w-0">
        <p className="text-xs font-semibold tracking-[0.12em] text-primary uppercase">
          Defined with a schema
        </p>
        <figcaption className="mt-1 font-mono text-xs text-muted-foreground">
          {props.source.file}
        </figcaption>
        <pre className="mt-2 overflow-x-auto font-mono text-sm leading-relaxed">
          <code className={tk.body}>{props.source.code}</code>
        </pre>
      </div>
    </figure>
  )
}

function ShotPicture(props: { shot: Shot; className?: string }) {
  return (
    <>
      <img
        src={props.shot.src}
        alt={props.shot.alt}
        decoding="async"
        className={cn("block object-cover object-top dark:hidden", props.className)}
      />
      <img
        src={props.shot.srcDark}
        alt={props.shot.alt}
        decoding="async"
        className={cn("hidden object-cover object-top dark:block", props.className)}
      />
    </>
  )
}

function BackgroundGrid() {
  return (
    <>
      <style href="fireargs-hero-background" precedence="default">
        {BACKGROUND_GRID_CSS}
      </style>
      <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute inset-0 [mask-image:linear-gradient(to_bottom,black_55%,transparent_98%)]">
          <div className="strata strata-drift absolute inset-y-0 -inset-x-11 opacity-50" />
          <div className="hero-scan-x from-primary/0 via-primary/16 to-primary/0 absolute inset-y-0 w-[40%] bg-gradient-to-r" />
          <div className="hero-scan-y from-secondary/0 via-secondary/16 to-secondary/0 absolute inset-x-0 h-[40%] bg-gradient-to-b" />
        </div>
      </div>
      <div
        aria-hidden
        className="hero-drift bg-primary/15 pointer-events-none absolute -top-40 -right-40 size-[32rem] rounded-full blur-3xl"
      />
    </>
  )
}

const BACKGROUND_GRID_CSS = `
@keyframes hero-scan-x {
  0% {
    transform: translateX(-55%);
    opacity: 0;
  }
  5%,
  45% {
    opacity: 1;
  }
  50%,
  100% {
    transform: translateX(155%);
    opacity: 0;
  }
}

@keyframes hero-scan-y {
  0%,
  50% {
    transform: translateY(-55%);
    opacity: 0;
  }
  55%,
  95% {
    opacity: 1;
  }
  100% {
    transform: translateY(155%);
    opacity: 0;
  }
}

@keyframes strata-drift {
  to {
    transform: translateX(44px);
  }
}

@keyframes hero-drift {
  0%,
  100% {
    transform: translate3d(0, 0, 0) scale(1);
  }
  50% {
    transform: translate3d(6%, -8%, 0) scale(1.08);
  }
}

.strata {
  background-image: repeating-linear-gradient(
    90deg,
    var(--color-border) 0,
    var(--color-border) 1px,
    transparent 1px,
    transparent 44px
  );
}

.strata-drift {
  animation: strata-drift 14s linear infinite;
}

.hero-scan-x {
  animation: hero-scan-x 18s cubic-bezier(0.4, 0, 0.6, 1) infinite;
}

.hero-scan-y {
  animation: hero-scan-y 18s cubic-bezier(0.4, 0, 0.6, 1) infinite;
}

.hero-drift {
  animation: hero-drift 18s ease-in-out infinite;
}

@keyframes hero-carousel-progress {
  from {
    transform: scaleX(0);
  }
  to {
    transform: scaleX(1);
  }
}

.hero-carousel-progress {
  transform-origin: left;
  animation: hero-carousel-progress 6s linear;
}

@media (prefers-reduced-motion: reduce) {
  .hero-scan-x,
  .hero-scan-y {
    animation: none;
    opacity: 0;
  }
  .strata-drift,
  .hero-drift,
  .hero-carousel-progress {
    animation: none;
  }
}
`

interface FreedomPoint {
  icon: ComponentType<SVGProps<SVGSVGElement>>
  title: string
  description: ReactNode
}

const freedoms: Record<Lang, FreedomPoint[]> = {
  python: [
    {
      icon: Layers,
      title: "Plain pydantic models",
      description: (
        <>
          Inputs and outputs are ordinary{" "}
          <code className="font-mono text-foreground">BaseModel</code> classes. Share
          fields as <code className="font-mono text-foreground">Annotated</code> aliases
          and groups as mixins; there is no DSL to learn.
        </>
      ),
    },
    {
      icon: Terminal,
      title: "A real click command",
      description: (
        <>
          Every command is a click{" "}
          <code className="font-mono text-foreground">Command</code> and every program a{" "}
          <code className="font-mono text-foreground">Group</code>. Contexts, plugins and
          the rest of click's API stay within reach.
        </>
      ),
    },
    {
      icon: Network,
      title: "Programs all the way down",
      description: (
        <>
          Group commands with{" "}
          <code className="font-mono text-foreground">Program(router=...)</code> and nest
          programs inside programs. See <ProgramsLink />.
        </>
      ),
    },
  ],
  typescript: [
    {
      icon: Layers,
      title: "Plain zod schemas",
      description: (
        <>
          Inputs and outputs are ordinary{" "}
          <code className="font-mono text-foreground">z.object(...)</code> schemas. Share
          fields with <code className="font-mono text-foreground">.extend</code> or a
          shape spread; there is no DSL to learn.
        </>
      ),
    },
    {
      icon: Terminal,
      title: "A real commander command",
      description: (
        <>
          Every builder compiles to a commander{" "}
          <code className="font-mono text-foreground">Command</code>. Hooks, help
          configuration and the rest of commander's API stay within reach.
        </>
      ),
    },
    {
      icon: Network,
      title: "Programs all the way down",
      description: (
        <>
          Group commands with{" "}
          <code className="font-mono text-foreground">f.program().router()</code> and nest
          programs inside programs. See <ProgramsLink />.
        </>
      ),
    },
  ],
}

function ProgramsLink() {
  const { lang } = useLang()
  return (
    <Link
      to="/$"
      params={{ _splat: `${lang}/programs` }}
      className="text-primary underline-offset-4 hover:underline"
    >
      Programs
    </Link>
  )
}

function Freedom() {
  const { lang } = useLang()
  return (
    <section className="border-b border-border">
      <div className="mx-auto max-w-6xl px-6 py-24">
        <Reveal>
          <div className="text-center max-w-2xl mx-auto mb-16">
            <div className="mb-6">
              <LangTabs />
            </div>
            <h2 className="text-3xl md:text-4xl font-bold tracking-tight">
              Still just {langs[lang].schema} and {langs[lang].cli}
            </h2>
            <p className="mt-4 text-muted-foreground text-lg">
              Fireargs fills in the boring parts and gets out of the way. Your{" "}
              {langs[lang].models} and your {langs[lang].cli} setup stay yours.
            </p>
          </div>
        </Reveal>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-10 md:gap-12 items-center">
          <ul className="space-y-8">
            {freedoms[lang].map((point, i) => (
              <li key={point.title}>
                <Reveal delayMs={i * 60}>
                  <div className="flex gap-4">
                    <div className="shrink-0 inline-flex items-center justify-center size-10 rounded-lg bg-primary/10 text-primary">
                      <point.icon className="size-5" />
                    </div>
                    <div>
                      <h3 className="text-lg font-semibold text-foreground">
                        {point.title}
                      </h3>
                      <p className="mt-1 text-sm text-muted-foreground leading-relaxed">
                        {point.description}
                      </p>
                    </div>
                  </div>
                </Reveal>
              </li>
            ))}
          </ul>
          <Reveal>
            <WindowCard label="shipit">
              <ProgramTree />
            </WindowCard>
            <p className="mt-3 text-center text-sm text-muted-foreground/60">
              The layout is only an example: routers take imported commands, not folders.
            </p>
          </Reveal>
        </div>
      </div>
    </section>
  )
}

const programTrees: Record<Lang, [string, string, string, string][]> = {
  python: [
    ["", "cli.py", "file", "Program()"],
    ["", "commands/", "dir", ""],
    ["├─ ", "deploy.py", "file", "@command()"],
    ["└─ ", "db/", "dir", ""],
    ["   ├─ ", "__init__.py", "file", "a nested program"],
    ["   └─ ", "migrate.py", "file", "a nested command"],
  ],
  typescript: [
    ["", "cli.ts", "file", "f.program()"],
    ["", "commands/", "dir", ""],
    ["├─ ", "deploy.ts", "file", "f.command()"],
    ["└─ ", "db/", "dir", ""],
    ["   ├─ ", "index.ts", "file", "a nested program"],
    ["   └─ ", "migrate.ts", "file", "a nested command"],
  ],
}

function ProgramTree() {
  const { lang } = useLang()
  return (
    <pre className="p-5 text-sm leading-relaxed font-mono overflow-x-auto">
      <code className={tk.body}>
        {programTrees[lang].map(([prefix, name, kind, note]) => (
          <span key={name}>
            <span className={tk.dim}>{prefix}</span>
            <span className={kind === "dir" ? tk.flag : tk.type}>{name}</span>
            {note && (
              <span className={cn(tk.dim, "hidden sm:inline")}>
                {`${" ".repeat(Math.max(1, 20 - prefix.length - name.length))}← ${note}`}
              </span>
            )}
            {"\n"}
          </span>
        ))}
        {"\n"}
        <span className={tk.prompt}>$</span> <span className={tk.func}>shipit</span> db
        migrate <span className={tk.flag}>--json</span>
        {"\n"}
        <span className={tk.prompt}>$</span> <span className={tk.func}>shipit</span>{" "}
        <span className={tk.flag}>--llms</span>
        <span className={cn(tk.dim, "hidden sm:inline")}>
          {"     ← every leaf, one manifest"}
        </span>
      </code>
    </pre>
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
      "Inputs and outputs are pydantic models or zod schemas. Descriptions, defaults, choices, and lists propagate to the CLI automatically.",
  },
  {
    icon: ShieldCheck,
    title: "Validated end-to-end",
    description:
      "Every input is validated before your handler runs and every output before it ships. One source of truth for types and runtime.",
  },
  {
    icon: Boxes,
    title: "Fully composable",
    description:
      "Share arguments, options and groups of them across commands. Group leaves into programs and nest programs in programs — same shape at every level.",
  },
  {
    icon: FileJson,
    title: "Built-in --json",
    description:
      "Every command takes JSON in and emits JSON out via --json. Drive it from a script or an agent — same binary.",
  },
  {
    icon: Bot,
    title: "Built-in --llms",
    description:
      "Each binary publishes an MCP-shaped tools/list manifest. LLM agents read it and call straight back through --json.",
  },
  {
    icon: Terminal,
    title: "Powered by click and commander",
    description:
      "What you get back is a click or commander command. Their whole API stays available — fireargs just fills in the boring parts.",
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
    <div className="h-full group relative rounded-card border border-border bg-card p-6 transition-all duration-200 hover:border-primary/40 hover:-translate-y-0.5 hover:shadow-lg">
      <div className="inline-flex items-center justify-center size-10 rounded-lg bg-primary/10 text-primary mb-4 group-hover:bg-primary/15 transition-colors">
        <Icon className="size-5" />
      </div>
      <h3 className="text-lg font-semibold text-foreground">{title}</h3>
      <p className="mt-2 text-sm text-muted-foreground leading-relaxed">{description}</p>
    </div>
  )
}

const sources: Record<Lang, string> = {
  python: `from typing import Annotated
from pydantic import BaseModel
from fireargs import Argument, Option, Program, command

# Composable arguments and options
Name = Annotated[str, Argument(description="Who to greet")]
Times = Annotated[int, Option(default=1, ge=1)]


# Composable groups of them
class GreetInput(BaseModel):
    name: Name
    times: Times


# Typed output, validated on every run
class Greeting(BaseModel):
    greeting: str


# A click command, typed from the handler's annotations
@command(description="Greet politely")
def greet(input: GreetInput) -> Greeting:
    words = [f"hello {input.name}"] * input.times
    return Greeting(greeting=" ".join(words))


# Composable commands: a router of leaves and nested programs
cli = Program(name="myapp", router={"greet": greet})

# Use as a normal click group, e.g. configure or apply plugins
if __name__ == "__main__":
    cli()`,
  typescript: `import { f } from "fireargs"
import { z } from "zod"

// Composable arguments and options
const name = f.argument().string().describe("Who to greet")
const times = f.option().schema(z.number().min(1).default(1))

// Composable groups of them
const greetInput = z.object({ name, times })

// Typed output, validated on every run
const greetOutput = z.object({ greeting: z.string() })

// A commander command, typed from the schemas
const greet = f
  .command({ name: "greet", description: "Greet politely" })
  .input(greetInput)
  .output(greetOutput)
  .handler(input => {
    const words = Array(input.times).fill(\`hello \${input.name}\`)
    return { greeting: words.join(" ") }
  })

// Composable commands: a router of leaves and nested programs
const cli = f.program({ name: "myapp" }).router({ greet })

// Use as a normal commander command, e.g. configure or apply plugins
cli.parseAsync(process.argv)`,
}

function SourceSample() {
  const { lang } = useLang()
  return (
    <pre className="p-5 text-sm leading-relaxed font-mono overflow-x-auto">
      <code className={tk.body}>{highlightCode(sources[lang], lang)}</code>
    </pre>
  )
}

const terminal = `$ myapp greet world --times 2 --json
{
  "greeting": "hello world hello world"
}

$ myapp greet --json '{"name":"world"}'
{
  "greeting": "hello world"
}

$ myapp --llms
{
  "tools": [
    { "name": "help", ... },
    {
      "name": "greet",
      "description": "Greet politely",
      "inputSchema": { ... },
      "outputSchema": { ... }
    }
  ]
}`

function TerminalSample() {
  return (
    <pre className="p-5 text-sm leading-relaxed font-mono overflow-x-auto">
      <code className={tk.body}>
        {terminal.split("\n").map((line, i) => (
          <span key={i}>
            {line.startsWith("$ ") ? highlightCommand(line) : highlightJson(line)}
            {"\n"}
          </span>
        ))}
      </code>
    </pre>
  )
}

const COMMAND_TOKEN = /(^\$)|('[^']*')|(--[\w-]+)|((?<=^\$ )\S+)|(\s+|\S+)/g

function highlightCommand(line: string) {
  return [...line.matchAll(COMMAND_TOKEN)].map(match => {
    const [text, prompt, string, flag, program] = match
    const className = prompt
      ? tk.prompt
      : string
        ? tk.string
        : flag
          ? tk.flag
          : program
            ? tk.func
            : undefined
    return className ? (
      <span key={match.index} className={className}>
        {text}
      </span>
    ) : (
      text
    )
  })
}

const JSON_TOKEN =
  /("[^"]*"(?=:))|("[^"]*")|(\b\d+\b)|(\.\.\.)|([{}[\],:])|(\s+|[^\s"{}[\],:.]+|\.)/g

function highlightJson(line: string) {
  return [...line.matchAll(JSON_TOKEN)].map(match => {
    const [text, key, string, number, ellipsis, punct] = match
    const className = key
      ? tk.key
      : string
        ? tk.string
        : number
          ? tk.type
          : ellipsis
            ? tk.dim
            : punct
              ? tk.punct
              : undefined
    return className ? (
      <span key={match.index} className={className}>
        {text}
      </span>
    ) : (
      text
    )
  })
}

function Showcase() {
  const { lang } = useLang()
  return (
    <section className="border-b border-border bg-primary/5">
      <div className="mx-auto max-w-6xl px-6 py-24">
        <Reveal>
          <div className="text-center max-w-2xl mx-auto mb-16">
            <div className="mb-6">
              <LangTabs />
            </div>
            <h2 className="text-3xl md:text-4xl font-bold tracking-tight">
              One schema, every interface
            </h2>
            <p className="mt-4 text-muted-foreground text-lg">
              The same {langs[lang].schema} {lang === "python" ? "model" : "schema"}{" "}
              drives <code className="font-mono">--help</code>,{" "}
              <code className="font-mono">--json</code>, and the LLM manifest.
            </p>
          </div>
        </Reveal>
        <Reveal>
          <div className="grid grid-cols-1 md:grid-cols-[4fr_3fr] gap-4 md:gap-6">
            <WindowCard label={langs[lang].file}>
              <SourceSample />
            </WindowCard>
            <WindowCard label="terminal">
              <TerminalSample />
            </WindowCard>
          </div>
        </Reveal>
        <Reveal delayMs={120}>
          <div className="mt-10 grid grid-cols-1 md:grid-cols-3 gap-4">
            <Bullet text="Descriptions surface in --help and the JSON Schema." />
            <Bullet
              text={`Defaults, choices, and optionality flow to ${langs[lang].cli} automatically.`}
            />
            <Bullet text="Every leaf gets --json '<value>' and --llms for free." />
          </div>
        </Reveal>
      </div>
    </section>
  )
}

function Bullet({ text }: { text: string }) {
  return (
    <div className="flex items-start gap-3 rounded-card border border-primary/20 bg-card/60 p-4">
      <CheckCircle2 className="size-5 text-primary shrink-0 mt-0.5" />
      <p className="text-sm text-foreground/90 leading-relaxed">{text}</p>
    </div>
  )
}

function WindowCard(props: { label: string; children: ReactNode }) {
  return (
    <div className="h-full rounded-card border border-primary/20 bg-card overflow-hidden">
      <div className="flex items-center gap-2 border-b border-primary/20 px-4 py-2 bg-muted/50">
        <div className="size-2.5 rounded-full bg-red-400/60" />
        <div className="size-2.5 rounded-full bg-yellow-400/60" />
        <div className="size-2.5 rounded-full bg-green-400/60" />
        <span className="ml-2 text-xs font-mono text-muted-foreground">
          {props.label}
        </span>
      </div>
      {props.children}
    </div>
  )
}

function FinalCta() {
  const { lang } = useLang()
  return (
    <section className="relative overflow-hidden">
      <div className="relative mx-auto max-w-3xl px-6 py-24 text-center">
        <Reveal>
          <h2 className="text-3xl md:text-5xl font-extrabold tracking-tight">
            Stop hand-rolling argument parsers.{" "}
            <span className="text-primary">Write a schema.</span>
          </h2>
          <p className="mt-6 text-lg text-muted-foreground">
            Install, write a command, ship a CLI that humans, agents, and scripts can all
            call.
          </p>
          <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-3">
            <Link
              to="/$"
              params={{ _splat: `${lang}/introduction` }}
              className={cn(
                buttonVariants({ variant: "default", size: "lg" }),
                "px-5 no-underline",
              )}
            >
              <BookOpen className="size-4" />
              Read the docs
            </Link>
            <Link
              to="/$"
              params={{ _splat: `${lang}/llms-mode` }}
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

function Datist() {
  return (
    <section className="border-t border-border bg-muted">
      <div className="mx-auto max-w-5xl px-6 py-10">
        <Reveal>
          <div className="flex flex-col items-center gap-3 text-center">
            <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
              Built by
            </p>
            <a
              href="https://datist.io"
              target="_blank"
              rel="noopener"
              className="text-sm font-medium text-foreground/70 hover:text-foreground transition-colors no-underline"
            >
              Datist — Software development, end to end.
            </a>
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
