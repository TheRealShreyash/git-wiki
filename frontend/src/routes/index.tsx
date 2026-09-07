import { createFileRoute } from '@tanstack/react-router'
import { motion } from 'motion/react'
import {
  ArrowRight,
  Braces,
  FileCode2,
  GitBranch,
  Layers,
  Lock,
  Radio,
  Sparkles,
  Zap,
} from 'lucide-react'
import { Link } from '@tanstack/react-router'
import { TypingTerminal } from '#/components/typing-terminal'
import { GridBackdrop, TopBar } from '#/components/shell'

const rise = {
  hidden: { opacity: 0, y: 12 },
  show: { opacity: 1, y: 0 },
}

const stagger = {
  hidden: {},
  show: { transition: { staggerChildren: 0.06, delayChildren: 0.05 } },
}

const PIPELINE = [
  {
    step: '01',
    icon: GitBranch,
    title: 'Crawl',
    body: 'Full git tree in a single request, blobs fetched through a bounded pool. Private repos ride on your PAT — the token never leaves the job.',
    meta: '1 request · pool=12',
  },
  {
    step: '02',
    icon: Layers,
    title: 'Chunk',
    body: 'Tree-sitter splits at syntax boundaries — functions, classes, exports — so a citation never cuts a function in half. Sliding window fallback.',
    meta: '512 tokens · 64 overlap',
  },
  {
    step: '03',
    icon: Braces,
    title: 'Embed',
    body: 'Batches of 96 through durable Inngest steps. A rate-limit hiccup retries the batch, never the clone.',
    meta: '1536 dims · HNSW',
  },
  {
    step: '04',
    icon: Sparkles,
    title: 'Answer',
    body: 'Hybrid semantic + lexical retrieval, then tokens stream back with the citation rail already filled in.',
    meta: '~20ms top-k',
  },
]

const FEATURES = [
  {
    icon: Radio,
    title: 'Watch it index, live',
    body: 'Four-stage tracker polling the job every second — files crawled, chunks generated, embeddings saved — with the raw Inngest step log underneath.',
  },
  {
    icon: FileCode2,
    title: 'Citations that go somewhere',
    body: 'Every answer carries source badges. Click one for a syntax-highlighted preview with the cited lines lit up, or jump straight to that line on GitHub.',
  },
  {
    icon: Zap,
    title: 'Token streaming',
    body: 'SSE from the first delta. Sources land before the answer starts typing, so you can read the receipts while it thinks.',
  },
  {
    icon: Lock,
    title: 'Private repos',
    body: 'Paste a fine-grained PAT with repo scope. Scoped per job, used only for the crawl, never persisted alongside the index.',
  },
]

const FAQ = [
  {
    q: 'What actually gets indexed?',
    a: 'Textual blobs only — ts, tsx, js, py, go, rs, rb, java, kt, md, json, yaml, toml, sql, sh. node_modules, dist, lockfiles and anything over 400 KB are dropped before a single byte is embedded.',
  },
  {
    q: 'How fresh is the index?',
    a: 'Indexing is idempotent per commit. Re-run a repo and only changed files are re-chunked; unchanged vectors are left in place.',
  },
  {
    q: 'What stops it from making things up?',
    a: 'The system prompt is context-only and temperature is pinned at 0.2. If retrieval comes back thin, the answer says so instead of guessing.',
  },
]

export const Route = createFileRoute('/')({ component: App })

function App() {
  return (
    <div className="relative min-h-screen">
      <GridBackdrop glow />
      <div className="relative z-10">
        <TopBar />

        {/* Hero */}
        <section className="mx-auto max-w-[1240px] px-6 pt-20 pb-24">
          <motion.div
            variants={stagger}
            initial="hidden"
            animate="show"
            className="grid items-center gap-14 lg:grid-cols-[1.05fr_1fr]"
          >
            <div>
              <motion.div
                variants={rise}
                className="mb-7 inline-flex items-center gap-2.5 border border-border bg-surface px-3 py-1.5"
              >
                <span className="size-1.5 rounded-full bg-accent" />
                <span className="text-[10px] uppercase tracking-[0.2em] text-muted">
                  retrieval-grounded · zero hallucination budget
                </span>
              </motion.div>

              <motion.h1
                variants={rise}
                className="font-display text-[clamp(2.6rem,6vw,4.4rem)] font-extrabold leading-[0.94] text-foreground"
              >
                Ask your codebase
                <br />
                <span className="text-dim">the question you'd</span>
                <br />
                ask <span className="text-accent">the author</span>.
              </motion.h1>

              <motion.p
                variants={rise}
                className="mt-7 max-w-[52ch] text-[13.5px] leading-[1.8] text-muted"
              >
                Point Grepr at any GitHub repository. It crawls the tree, splits
                it on syntax boundaries, embeds every chunk, and gives you a
                chat window that answers with the actual code — cited down to
                the line number.
              </motion.p>

              <motion.div
                variants={rise}
                className="mt-9 flex flex-wrap items-center gap-3"
              >
                <Link
                  to="/repos"
                  className="group flex h-11 items-center gap-2.5 border border-accent bg-accent px-6 text-[12px] font-bold uppercase tracking-[0.14em] text-[#0a0b0c] transition-colors hover:bg-accent-dim"
                >
                  index a repository
                  <ArrowRight className="size-3.5 transition-transform group-hover:translate-x-0.5" />
                </Link>
                <Link
                  to="/repos"
                  className="flex h-11 items-center border border-border bg-surface px-6 text-[12px] uppercase tracking-[0.14em] text-muted transition-colors hover:border-border-strong hover:text-foreground"
                >
                  see a live demo
                </Link>
              </motion.div>

              <motion.div
                variants={rise}
                className="mt-10 flex flex-wrap gap-x-8 gap-y-3 border-t border-border pt-6"
              >
                {[
                  ['26s', 'median index'],
                  ['1536', 'embedding dims'],
                  ['~20ms', 'top-k retrieval'],
                  ['4', 'durable steps'],
                ].map(([value, label]) => (
                  <div key={label}>
                    <div className="font-display text-xl font-bold text-foreground">
                      {value}
                    </div>
                    <div className="label mt-1">{label}</div>
                  </div>
                ))}
              </motion.div>
            </div>

            <motion.div variants={rise}>
              <TypingTerminal />
            </motion.div>
          </motion.div>
        </section>

        {/* Pipeline */}
        <section id="pipeline" className="border-y border-border bg-surface/40">
          <div className="mx-auto max-w-[1240px] px-6 py-20">
            <div className="mb-12 flex flex-wrap items-end justify-between gap-4">
              <div>
                <div className="label mb-3">the pipeline</div>
                <h2 className="font-display text-3xl font-bold text-foreground">
                  Four durable steps, nothing hidden
                </h2>
              </div>
              <p className="max-w-[42ch] text-[12.5px] leading-relaxed text-muted">
                Every stage is checkpointed independently. A failure while
                embedding never re-clones the repository.
              </p>
            </div>

            <div className="grid gap-px border border-border bg-border md:grid-cols-2 lg:grid-cols-4">
              {PIPELINE.map((item, index) => (
                <motion.div
                  key={item.step}
                  initial={{ opacity: 0, y: 10 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, margin: '-60px' }}
                  transition={{ delay: index * 0.07, duration: 0.4 }}
                  className="group relative bg-background p-7 transition-colors hover:bg-surface"
                >
                  <div className="absolute right-6 top-6 font-display text-2xl font-bold text-border-strong transition-colors group-hover:text-accent/30">
                    {item.step}
                  </div>
                  <item.icon className="size-4 text-accent" />
                  <h3 className="font-display mt-5 text-lg font-bold text-foreground">
                    {item.title}
                  </h3>
                  <p className="mt-3 text-[12.5px] leading-[1.75] text-muted">
                    {item.body}
                  </p>
                  <div className="label mt-6 border-t border-border pt-4">
                    {item.meta}
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        </section>

        {/* Features */}
        <section className="mx-auto max-w-[1240px] px-6 py-20">
          <div className="label mb-3">what you get</div>
          <h2 className="font-display mb-12 max-w-[20ch] text-3xl font-bold text-foreground">
            Built like an IDE, not a chatbot
          </h2>

          <div className="grid gap-px border border-border bg-border sm:grid-cols-2">
            {FEATURES.map((feature, index) => (
              <motion.div
                key={feature.title}
                initial={{ opacity: 0, y: 10 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: '-60px' }}
                transition={{ delay: index * 0.06, duration: 0.4 }}
                className="flex gap-5 bg-background p-8 transition-colors hover:bg-surface"
              >
                <span className="flex size-9 shrink-0 items-center justify-center border border-border bg-surface-2 text-accent">
                  <feature.icon className="size-4" />
                </span>
                <div>
                  <h3 className="text-[13.5px] font-semibold text-foreground">
                    {feature.title}
                  </h3>
                  <p className="mt-2.5 text-[12.5px] leading-[1.75] text-muted">
                    {feature.body}
                  </p>
                </div>
              </motion.div>
            ))}
          </div>
        </section>

        {/* FAQ */}
        <section id="faq" className="border-t border-border bg-surface/40">
          <div className="mx-auto grid max-w-[1240px] gap-12 px-6 py-20 lg:grid-cols-[0.8fr_1.2fr]">
            <div>
              <div className="label mb-3">docs</div>
              <h2 className="font-display text-3xl font-bold text-foreground">
                Details that
                <br />
                matter
              </h2>
            </div>
            <dl className="divide-y divide-border border-y border-border">
              {FAQ.map((item) => (
                <div key={item.q} className="py-6">
                  <dt className="text-[13px] font-semibold text-foreground">
                    {item.q}
                  </dt>
                  <dd className="mt-2.5 max-w-[70ch] text-[12.5px] leading-[1.8] text-muted">
                    {item.a}
                  </dd>
                </div>
              ))}
            </dl>
          </div>
        </section>

        {/* CTA */}
        <section className="mx-auto max-w-[1240px] px-6 py-24">
          <div className="relative overflow-hidden border border-border bg-surface p-12 text-center">
            <div className="pointer-events-none absolute inset-x-0 bottom-0 h-[240px] accent-glow rotate-180" />
            <div className="relative">
              <h2 className="font-display mx-auto max-w-[22ch] text-[clamp(1.8rem,4vw,2.8rem)] font-extrabold leading-[1.05] text-foreground">
                Stop reading the repo. Interrogate it.
              </h2>
              <Link
                to="/repos"
                className="group mx-auto mt-9 flex h-11 w-fit items-center gap-2.5 border border-accent bg-accent px-7 text-[12px] font-bold uppercase tracking-[0.14em] text-[#0a0b0c] transition-colors hover:bg-accent-dim"
              >
                paste a github url
                <ArrowRight className="size-3.5 transition-transform group-hover:translate-x-0.5" />
              </Link>
            </div>
          </div>
        </section>

        <footer className="border-t border-border">
          <div className="mx-auto flex max-w-[1240px] flex-wrap items-center justify-between gap-4 px-6 py-8">
            <span className="label">grepr · retrieval over repositories</span>
            <span className="label">built for engineers who read code</span>
          </div>
        </footer>
      </div>
    </div>
  )
}
