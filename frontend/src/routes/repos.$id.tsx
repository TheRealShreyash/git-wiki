import { createFileRoute } from '@tanstack/react-router'

import { motion } from 'motion/react'
import {
  ArrowRight,
  Check,
  ExternalLink,
  Loader2,
  Lock,
  Terminal,
} from 'lucide-react'
import { useEffect, useRef } from 'react'
import { Link, useParams } from '@tanstack/react-router'
import { cn } from '@/lib/utils'
import { GridBackdrop, StatusDot, TopBar } from '../components/shell'
import { useIndexStatus, useRepo } from '../queries/repos'

const LOG_COLORS: Record<string, string> = {
  info: 'text-muted',
  step: 'text-info',
  warn: 'text-warn',
  ok: 'text-accent',
}

function StageCard({
  stage,
  index,
}: {
  stage: {
    id: string
    label: string
    status: string
    progress: number
    count: number
    total: number
    unit: string
  }
  index: number
}) {
  const running = stage.status === 'running'
  const done = stage.status === 'done'

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.06 }}
      className={cn(
        'relative overflow-hidden bg-background p-6 transition-colors',
        running && 'bg-surface',
      )}
    >
      {running && (
        <div className="absolute inset-x-0 top-0 h-px overflow-hidden">
          <div className="h-full w-1/4 scan-line" />
        </div>
      )}

      <div className="flex items-center justify-between">
        <span className="label">
          {String(index + 1).padStart(2, '0')} · {stage.id}
        </span>
        {done ? (
          <Check className="size-3.5 text-accent" />
        ) : running ? (
          <Loader2 className="size-3.5 animate-spin text-warn" />
        ) : (
          <span className="size-1.5 rounded-full bg-border-strong" />
        )}
      </div>

      <div className="mt-5 font-display text-[26px] font-bold leading-none text-foreground tabular-nums">
        {stage.id === 'clone'
          ? done
            ? 'done'
            : running
              ? '…'
              : '—'
          : stage.count.toLocaleString()}
        {stage.id !== 'clone' && (
          <span className="ml-1.5 text-[13px] font-normal text-dim">
            / {stage.total.toLocaleString()}
          </span>
        )}
      </div>

      <div className="mt-2 text-[12px] text-muted">{stage.label}</div>

      <div className="mt-5 h-[3px] w-full bg-surface-2">
        <motion.div
          className={cn(
            'h-full',
            done ? 'bg-accent' : running ? 'bg-warn' : 'bg-transparent',
          )}
          initial={false}
          animate={{ width: `${Math.round(stage.progress * 100)}%` }}
          transition={{ duration: 0.6, ease: 'easeOut' }}
        />
      </div>
    </motion.div>
  )
}

export const Route = createFileRoute('/repos/$id')({
  component: Repo,
})

function Repo() {
  const { id } = useParams({ from: '/repos/$id' })
  const repo = useRepo(id)
  const status = useIndexStatus(id)
  const logRef = useRef<HTMLDivElement>(null)

  const ready = status.data?.status === 'ready'
  const logCount = status.data?.logs.length ?? 0

  useEffect(() => {
    logRef.current?.scrollTo({
      top: logRef.current.scrollHeight,
      behavior: 'smooth',
    })
  }, [logCount])

  if (repo.isError) {
    return (
      <div className="relative min-h-screen">
        <GridBackdrop />
        <div className="relative z-10">
          <TopBar />
          <div className="mx-auto max-w-[1240px] px-6 py-32 text-center">
            <p className="text-[13px] text-muted">
              That repository isn't indexed.
            </p>
            <Link
              to="/repos"
              className="mt-4 inline-block text-[12px] text-accent hover:underline"
            >
              ← back to repositories
            </Link>
          </div>
        </div>
      </div>
    )
  }

  const elapsed = ((status.data?.elapsedMs ?? 0) / 1000).toFixed(1)

  return (
    <div className="relative min-h-screen">
      <GridBackdrop />
      <div className="relative z-10">
        <TopBar />

        <main className="mx-auto max-w-[1240px] px-6 py-12">
          {/* Header */}
          <div className="flex flex-wrap items-end justify-between gap-6 border-b border-border pb-8">
            <div className="min-w-0">
              <Link
                to="/repos"
                className="label transition-colors hover:text-muted"
              >
                ← repositories
              </Link>
              <h1 className="font-display mt-4 flex items-center gap-3 text-4xl font-extrabold text-foreground">
                {repo.data?.slug ?? id}
                {repo.data?.isPrivate && <Lock className="size-4 text-warn" />}
              </h1>
              <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1.5 text-[11.5px] text-dim">
                <StatusDot status={status.data?.status ?? 'queued'} />
                <span className="uppercase tracking-[0.12em] text-muted">
                  {status.data?.status ?? 'queued'}
                </span>
                <span className="text-border-strong">/</span>
                <span>{repo.data?.branch ?? 'main'}</span>
                <span className="text-border-strong">/</span>
                <span className="tabular-nums">{elapsed}s elapsed</span>
                <span className="text-border-strong">/</span>
                <span className="truncate font-mono">
                  event {status.data?.eventId ?? '—'}
                </span>
                {repo.data && (
                  <a
                    href={repo.data.url}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center gap-1.5 text-info hover:underline"
                  >
                    open on github <ExternalLink className="size-3" />
                  </a>
                )}
              </div>
            </div>

            {ready ? (
              <Link
                to="/chat/$id"
                params={{ id }}
                className="group flex h-11 items-center gap-2.5 border border-accent bg-accent px-6 text-[12px] font-bold uppercase tracking-[0.14em] text-[#0a0b0c] transition-colors hover:bg-accent-dim"
              >
                start chatting
                <ArrowRight className="size-3.5 transition-transform group-hover:translate-x-0.5" />
              </Link>
            ) : (
              <span className="pointer-events-none flex h-11 items-center gap-2.5 border border-border bg-surface-2 px-6 text-[12px] font-bold uppercase tracking-[0.14em] text-dim">
                <Loader2 className="size-3.5 animate-spin" />
                indexing…
              </span>
            )}
          </div>

          {/* Overall progress */}
          <div className="mt-8">
            <div className="flex items-end justify-between">
              <span className="label">overall</span>
              <span className="font-display text-2xl font-bold tabular-nums text-foreground">
                {Math.round((status.data?.progress ?? 0) * 100)}%
              </span>
            </div>
            <div className="mt-3 h-[5px] w-full bg-surface-2">
              <motion.div
                className={cn('h-full', ready ? 'bg-accent' : 'bg-warn')}
                initial={false}
                animate={{
                  width: `${Math.round((status.data?.progress ?? 0) * 100)}%`,
                }}
                transition={{ duration: 0.9, ease: 'linear' }}
              />
            </div>
          </div>

          {/* Stages */}
          <div className="mt-8 grid gap-px border border-border bg-border sm:grid-cols-2 lg:grid-cols-4">
            {(status.data?.stages ?? []).map((stage, index) => (
              <StageCard key={stage.id} stage={stage} index={index} />
            ))}
            {status.isLoading &&
              [0, 1, 2, 3].map((row) => (
                <div key={row} className="h-[190px] animate-pulse bg-surface" />
              ))}
          </div>

          {/* Job log */}
          <div className="mt-8 border border-border">
            <div className="flex items-center justify-between border-b border-border bg-surface px-5 py-3">
              <span className="flex items-center gap-2.5">
                <Terminal className="size-3.5 text-accent" />
                <span className="label">inngest step log</span>
              </span>
              <span className="label">{logCount} lines</span>
            </div>
            <div
              ref={logRef}
              className="h-[280px] overflow-y-auto bg-background px-5 py-4"
            >
              {(status.data?.logs ?? []).map((log, index) => (
                <motion.div
                  key={`${log.at}-${index}`}
                  initial={{ opacity: 0, x: -4 }}
                  animate={{ opacity: 1, x: 0 }}
                  className="flex gap-4 py-[3px] text-[12px] leading-relaxed"
                >
                  <span className="shrink-0 tabular-nums text-dim">
                    {new Date(log.at).toLocaleTimeString('en-GB', {
                      hour12: false,
                    })}
                  </span>
                  <span
                    className={cn(
                      'shrink-0 uppercase text-[10px] pt-[3px] tracking-[0.14em]',
                      LOG_COLORS[log.level],
                    )}
                  >
                    {log.level}
                  </span>
                  <span className="text-foreground/80">{log.text}</span>
                </motion.div>
              ))}
              {!ready && (
                <div className="flex gap-4 py-[3px] text-[12px]">
                  <span className="text-dim">…</span>
                  <span className="caret" />
                </div>
              )}
            </div>
          </div>
        </main>
      </div>
    </div>
  )
}
