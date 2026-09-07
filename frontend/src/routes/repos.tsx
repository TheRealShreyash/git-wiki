import { createFileRoute } from '@tanstack/react-router'

import { motion } from 'motion/react'
import {
  AlertCircle,
  ArrowRight,
  Eye,
  EyeOff,
  Loader2,
  Lock,
  MessagesSquare,
  Plus,
} from 'lucide-react'
import { useState } from 'react'
import { Link, useNavigate } from '@tanstack/react-router'
import { cn } from '@/lib/utils'
import { Github } from '../components/icons/github'
import { GridBackdrop, StatusDot, TopBar } from '../components/shell'
import { useIndexRepo, useRepos } from '../queries/repos'

const EXAMPLES = [
  'https://github.com/honojs/hono',
  'https://github.com/drizzle-team/drizzle-orm',
  'https://github.com/inngest/inngest-js',
]

function OnboardCard() {
  const [url, setUrl] = useState('')
  const [token, setToken] = useState('')
  const [showToken, setShowToken] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const navigate = useNavigate()
  const indexRepo = useIndexRepo()

  const submit = (event: React.FormEvent) => {
    event.preventDefault()
    setError(null)
    indexRepo.mutate(
      { url: url.trim(), githubToken: token.trim() || undefined },
      {
        onSuccess: (data) =>
          navigate({ to: '/repos/$id', params: { id: data.id } }),
        onError: (mutationError) => setError(mutationError.message),
      },
    )
  }

  return (
    <div className="border border-border bg-surface">
      <div className="flex items-center gap-2.5 border-b border-border px-5 py-3">
        <Plus className="size-3.5 text-accent" />
        <span className="label">index a repository</span>
      </div>

      <form onSubmit={submit} className="p-5">
        <label className="label mb-2.5 block text-muted">github url</label>
        <div className="flex items-center border border-border bg-surface-2 focus-within:border-accent/50">
          <Github className="ml-3.5 size-3.5 shrink-0 text-dim" />
          <input
            value={url}
            onChange={(event) => setUrl(event.target.value)}
            placeholder="https://github.com/owner/repo"
            spellCheck={false}
            className="h-11 w-full bg-transparent px-3 text-[13px] text-foreground placeholder:text-dim focus:outline-none"
          />
        </div>

        <div className="mt-2 flex flex-wrap items-center gap-2">
          <span className="label">try</span>
          {EXAMPLES.map((example) => (
            <button
              key={example}
              type="button"
              onClick={() => setUrl(example)}
              className="border border-border px-2 py-1 text-[10.5px] text-dim transition-colors hover:border-border-strong hover:text-muted"
            >
              {example.replace('https://github.com/', '')}
            </button>
          ))}
        </div>

        <label className="label mt-6 mb-2.5 flex items-center gap-2 text-muted">
          <Lock className="size-3" />
          personal access token
          <span className="text-dim normal-case tracking-normal">
            — private repos only
          </span>
        </label>
        <div className="flex items-center border border-border bg-surface-2 focus-within:border-accent/50">
          <input
            value={token}
            onChange={(event) => setToken(event.target.value)}
            type={showToken ? 'text' : 'password'}
            placeholder="ghp_••••••••••••••••••••••••"
            spellCheck={false}
            autoComplete="off"
            className="h-11 w-full bg-transparent px-3.5 text-[13px] text-foreground placeholder:text-dim focus:outline-none"
          />
          <button
            type="button"
            onClick={() => setShowToken((value) => !value)}
            className="px-3.5 text-dim transition-colors hover:text-muted"
          >
            {showToken ? (
              <EyeOff className="size-3.5" />
            ) : (
              <Eye className="size-3.5" />
            )}
          </button>
        </div>
        <p className="mt-2 text-[11px] leading-relaxed text-dim">
          Scoped to the crawl step and dropped when the job finishes. Needs{' '}
          <code className="text-muted">repo</code> scope.
        </p>

        {error && (
          <div className="mt-4 flex items-start gap-2.5 border border-danger/30 bg-danger/5 px-3.5 py-3 text-[12px] text-danger">
            <AlertCircle className="mt-0.5 size-3.5 shrink-0" />
            {error}
          </div>
        )}

        <button
          type="submit"
          disabled={!url.trim() || indexRepo.isPending}
          className="group mt-5 flex h-11 w-full items-center justify-center gap-2.5 border border-accent bg-accent text-[12px] font-bold uppercase tracking-[0.14em] text-[#0a0b0c] transition-colors hover:bg-accent-dim disabled:cursor-not-allowed disabled:border-border disabled:bg-surface-2 disabled:text-dim"
        >
          {indexRepo.isPending ? (
            <>
              <Loader2 className="size-3.5 animate-spin" />
              queueing job
            </>
          ) : (
            <>
              start indexing
              <ArrowRight className="size-3.5 transition-transform group-hover:translate-x-0.5" />
            </>
          )}
        </button>
      </form>
    </div>
  )
}

function RepoRow({
  repo,
  index,
}: {
  repo: {
    id: string
    slug: string
    branch: string
    isPrivate: boolean
    language: string
    totalFiles: number
    totalChunks: number
    status: string
    progress: number
  }
  index: number
}) {
  const ready = repo.status === 'ready'

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.04 }}
    >
      <Link
        to={ready ? '/chat/$id' : '/repos/$id'}
        params={{ id: repo.id }}
        className="group relative flex items-center gap-5 border-b border-border bg-background px-5 py-4 transition-colors last:border-b-0 hover:bg-surface"
      >
        <StatusDot status={repo.status} />

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2.5">
            <span className="truncate text-[13px] font-medium text-foreground">
              {repo.slug}
            </span>
            {repo.isPrivate && <Lock className="size-3 shrink-0 text-warn" />}
          </div>
          <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-dim">
            <span>{repo.branch}</span>
            <span className="text-border-strong">/</span>
            <span>{repo.language}</span>
            <span className="text-border-strong">/</span>
            <span>{repo.totalFiles.toLocaleString()} files</span>
            <span className="text-border-strong">/</span>
            <span>{repo.totalChunks.toLocaleString()} chunks</span>
          </div>
        </div>

        <div className="hidden w-40 sm:block">
          <div className="h-[3px] w-full bg-surface-2">
            <div
              className={cn(
                'h-full transition-[width] duration-700',
                ready ? 'bg-accent' : 'bg-warn',
              )}
              style={{ width: `${Math.round(repo.progress * 100)}%` }}
            />
          </div>
          <div className="label mt-2">
            {ready
              ? 'indexed'
              : `${Math.round(repo.progress * 100)}% · ${repo.status}`}
          </div>
        </div>

        <span
          className={cn(
            'flex h-8 items-center gap-2 border px-3 text-[11px] uppercase tracking-[0.12em] transition-colors',
            ready
              ? 'border-border text-muted group-hover:border-accent group-hover:text-accent'
              : 'border-border text-dim',
          )}
        >
          {ready ? (
            <MessagesSquare className="size-3" />
          ) : (
            <Loader2 className="size-3 animate-spin" />
          )}
          {ready ? 'chat' : 'indexing'}
        </span>
      </Link>
    </motion.div>
  )
}

export const Route = createFileRoute('/repos')({
  component: Repos,
})

function Repos() {
  const repos = useRepos()

  return (
    <div className="relative min-h-screen">
      <GridBackdrop />
      <div className="relative z-10">
        <TopBar />
        <main className="mx-auto max-w-[1240px] px-6 py-12">
          <div className="mb-10">
            <div className="label mb-3">workspace</div>
            <h1 className="font-display text-4xl font-extrabold text-foreground">
              Repositories
            </h1>
            <p className="mt-3 max-w-[60ch] text-[13px] leading-relaxed text-muted">
              Every repository you've indexed, with live job state. Public repos
              need nothing but a URL; private ones take a personal access token.
            </p>
          </div>

          <div className="grid gap-8 lg:grid-cols-[1.35fr_1fr]">
            <section className="order-2 border border-border lg:order-1">
              <div className="flex items-center justify-between border-b border-border bg-surface px-5 py-3">
                <span className="label">indexed repositories</span>
                <span className="label">{repos.data?.length ?? 0} total</span>
              </div>

              {repos.isLoading && (
                <div className="space-y-px p-5">
                  {[0, 1, 2].map((row) => (
                    <div
                      key={row}
                      className="h-14 animate-pulse bg-surface-2"
                    />
                  ))}
                </div>
              )}

              {!repos.isLoading && !repos.data?.length && (
                <div className="px-5 py-20 text-center">
                  <div className="mx-auto flex size-10 items-center justify-center border border-border bg-surface-2 text-dim">
                    <Github className="size-4" />
                  </div>
                  <p className="mt-5 text-[13px] text-muted">
                    No repositories indexed yet.
                  </p>
                  <p className="mt-1.5 text-[12px] text-dim">
                    Paste a GitHub URL to run your first job.
                  </p>
                </div>
              )}

              {repos.data?.map((repo, index) => (
                <RepoRow key={repo.id} repo={repo} index={index} />
              ))}
            </section>

            <div className="order-1 lg:order-2">
              <OnboardCard />
            </div>
          </div>
        </main>
      </div>
    </div>
  )
}
