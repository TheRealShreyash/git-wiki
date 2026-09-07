import { createFileRoute } from '@tanstack/react-router'

import { motion } from 'motion/react'
import {
  ArrowUp,
  CornerDownLeft,
  ExternalLink,
  FileCode2,
  Lock,
  RotateCcw,
  Square,
} from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useParams } from '@tanstack/react-router'
import { cn } from '@/lib/utils'
import { Markdown } from '../components/markdown'
import { GridBackdrop, StatusDot, TopBar } from '../components/shell'
import { SourcePreview } from '../components/source-preview'
import type { ChatMessage, SourceCitation } from '../lib/backend'
import { githubLineUrl, streamChat } from '../lib/backend'
import {
  useClearMessages,
  useMessages,
  useRepo,
  useSuggestions,
} from '../queries/repos'

function SourceBadge({
  source,
  onOpen,
  githubHref,
  compact = false,
}: {
  source: SourceCitation
  onOpen: () => void
  githubHref: string
  compact?: boolean
}) {
  const file = source.path.split('/').pop() ?? source.path
  const dir = source.path.slice(0, source.path.length - file.length)

  return (
    <div
      className={cn(
        'group border border-border bg-surface transition-colors hover:border-accent/50',
        compact ? 'px-2.5 py-1.5' : 'p-3',
      )}
    >
      <button type="button" onClick={onOpen} className="block w-full text-left">
        <div className="flex items-start gap-2">
          <FileCode2 className="mt-0.5 size-3 shrink-0 text-dim transition-colors group-hover:text-accent" />
          <span className="min-w-0 flex-1">
            <span className="block truncate text-[11.5px] text-foreground">
              <span className="text-dim">{dir}</span>
              {file}
            </span>
            <span className="mt-1 block text-[10.5px] text-dim">
              lines {source.startLine}–{source.endLine}
              <span className="mx-1.5 text-border-strong">·</span>
              <span className="text-accent/70">{source.score.toFixed(2)}</span>
            </span>
          </span>
        </div>
      </button>
      {!compact && (
        <a
          href={githubHref}
          target="_blank"
          rel="noreferrer"
          className="mt-2.5 flex items-center gap-1.5 border-t border-border pt-2 text-[10px] uppercase tracking-[0.12em] text-dim transition-colors hover:text-info"
        >
          github <ExternalLink className="size-2.5" />
        </a>
      )}
    </div>
  )
}

export const Route = createFileRoute('/chat/$id')({
  component: Chat,
})

function Chat() {
  const { id } = useParams({ from: '/chat/$id' })
  const repo = useRepo(id)
  const history = useMessages(id)
  const suggestions = useSuggestions()
  const clearMessages = useClearMessages()

  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState('')
  const [streaming, setStreaming] = useState(false)
  const [preview, setPreview] = useState<SourceCitation | null>(null)
  const abortRef = useRef<AbortController | null>(null)
  const scrollRef = useRef<HTMLDivElement>(null)
  const hydrated = useRef(false)

  useEffect(() => {
    if (hydrated.current || !history.data) return
    hydrated.current = true
    setMessages(history.data)
  }, [history.data])

  useEffect(() => {
    scrollRef.current?.scrollTo({
      top: scrollRef.current.scrollHeight,
      behavior: 'smooth',
    })
  }, [messages])

  const send = useCallback(
    (question: string) => {
      const text = question.trim()
      if (!text || streaming) return

      const now = Date.now()
      setInput('')
      setStreaming(true)
      setMessages((current) => [
        ...current,
        {
          id: `u_${now}`,
          role: 'user',
          content: text,
          sources: [],
          createdAt: now,
        },
        {
          id: `a_${now}`,
          role: 'assistant',
          content: '',
          sources: [],
          createdAt: now,
          streaming: true,
        },
      ])

      const controller = new AbortController()
      abortRef.current = controller

      const patchLast = (patch: (message: ChatMessage) => ChatMessage) =>
        setMessages((current) =>
          current.map((message, index) =>
            index === current.length - 1 ? patch(message) : message,
          ),
        )

      streamChat(
        { repoId: id, question: text },
        {
          onSources: (sources) =>
            patchLast((message) => ({ ...message, sources })),
          onToken: (token) =>
            patchLast((message) => ({
              ...message,
              content: message.content + token,
            })),
          onDone: () => {
            patchLast((message) => ({ ...message, streaming: false }))
            setStreaming(false)
          },
          onError: (error) => {
            patchLast((message) => ({
              ...message,
              streaming: false,
              content:
                message.content || `**Stream failed** — ${error.message}`,
            }))
            setStreaming(false)
          },
        },
        controller.signal,
      )
    },
    [id, streaming],
  )

  const stop = () => {
    abortRef.current?.abort()
    setStreaming(false)
    setMessages((current) =>
      current.map((message, index) =>
        index === current.length - 1
          ? { ...message, streaming: false }
          : message,
      ),
    )
  }

  const reset = () => {
    stop()
    clearMessages.mutate({ id }, { onSuccess: () => setMessages([]) })
  }

  const activeSources = useMemo(() => {
    for (let index = messages.length - 1; index >= 0; index--) {
      if (
        messages[index].role === 'assistant' &&
        messages[index].sources.length
      ) {
        return messages[index].sources
      }
    }
    return []
  }, [messages])

  const owner = repo.data?.owner ?? ''
  const name = repo.data?.name ?? ''
  const branch = repo.data?.branch ?? 'main'
  const hrefFor = (source: SourceCitation) =>
    githubLineUrl(
      owner,
      name,
      branch,
      source.path,
      source.startLine,
      source.endLine,
    )

  return (
    <div className="relative flex h-screen flex-col overflow-hidden">
      <GridBackdrop />
      <div className="relative z-10 flex h-full flex-col">
        <TopBar
          right={
            <button
              type="button"
              onClick={reset}
              className="flex h-8 items-center gap-2 border border-border px-3 text-[11px] uppercase tracking-[0.12em] text-dim transition-colors hover:border-border-strong hover:text-foreground"
            >
              <RotateCcw className="size-3" /> reset
            </button>
          }
        />

        <div className="grid min-h-0 flex-1 lg:grid-cols-[1fr_330px]">
          {/* Conversation */}
          <div className="flex min-h-0 flex-col border-r border-border">
            <div className="flex items-center gap-3 border-b border-border bg-surface/60 px-6 py-3">
              <StatusDot status={repo.data?.status ?? 'queued'} />
              <span className="truncate text-[12.5px] text-foreground">
                {repo.data?.slug ?? id}
              </span>
              {repo.data?.isPrivate && <Lock className="size-3 text-warn" />}
              <span className="label ml-auto hidden sm:block">
                {repo.data?.totalChunks.toLocaleString() ?? '—'} chunks indexed
              </span>
              <Link
                to="/repos/$id"
                params={{ id }}
                className="label transition-colors hover:text-muted"
              >
                job ↗
              </Link>
            </div>

            <div
              ref={scrollRef}
              className="min-h-0 flex-1 overflow-y-auto px-6 py-8"
            >
              <div className="mx-auto max-w-[760px]">
                {messages.length === 0 && (
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                  >
                    <h1 className="font-display text-3xl font-extrabold text-foreground">
                      Ask {repo.data?.name ?? 'the repo'} anything
                    </h1>
                    <p className="mt-3 max-w-[56ch] text-[13px] leading-relaxed text-muted">
                      Answers come only from indexed chunks. Every claim ships
                      with the file and line range it came from.
                    </p>
                    <div className="mt-8 grid gap-px border border-border bg-border sm:grid-cols-2">
                      {(suggestions.data ?? []).map((question) => (
                        <button
                          key={question}
                          type="button"
                          onClick={() => send(question)}
                          className="group flex items-center justify-between gap-3 bg-background p-4 text-left text-[12.5px] text-muted transition-colors hover:bg-surface hover:text-foreground"
                        >
                          {question}
                          <CornerDownLeft className="size-3 shrink-0 text-dim transition-colors group-hover:text-accent" />
                        </button>
                      ))}
                    </div>
                  </motion.div>
                )}

                <div className="space-y-8">
                  {messages.map((message) =>
                    message.role === 'user' ? (
                      <div key={message.id} className="flex justify-end">
                        <div className="max-w-[80%] border border-border bg-surface px-4 py-3 text-[13px] text-foreground">
                          {message.content}
                        </div>
                      </div>
                    ) : (
                      <div key={message.id}>
                        <div className="mb-3 flex items-center gap-2.5">
                          <span className="size-1.5 bg-accent" />
                          <span className="label">grepr</span>
                          {message.streaming && !message.content && (
                            <span className="text-[11px] text-dim">
                              retrieving context…
                            </span>
                          )}
                        </div>

                        {message.sources.length > 0 && (
                          <div className="mb-4 flex flex-wrap gap-1.5">
                            {message.sources.map((source) => (
                              <button
                                key={`${source.path}:${source.startLine}`}
                                type="button"
                                onClick={() => setPreview(source)}
                                className="flex items-center gap-1.5 border border-border bg-surface-2 px-2 py-1 text-[10.5px] text-muted transition-colors hover:border-accent/50 hover:text-accent"
                              >
                                <FileCode2 className="size-2.5" />
                                {source.path.split('/').pop()}:
                                {source.startLine}-{source.endLine}
                              </button>
                            ))}
                          </div>
                        )}

                        <Markdown>{message.content}</Markdown>
                        {message.streaming && message.content && (
                          <span className="caret" />
                        )}
                      </div>
                    ),
                  )}
                </div>
              </div>
            </div>

            {/* Composer */}
            <div className="border-t border-border bg-background px-6 py-4">
              <div className="mx-auto max-w-[760px]">
                <form
                  onSubmit={(event) => {
                    event.preventDefault()
                    send(input)
                  }}
                  className="flex items-end gap-2 border border-border bg-surface px-3 py-2 focus-within:border-accent/50"
                >
                  <span className="pb-2 pl-1 text-accent">❯</span>
                  <textarea
                    value={input}
                    onChange={(event) => setInput(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter' && !event.shiftKey) {
                        event.preventDefault()
                        send(input)
                      }
                    }}
                    rows={1}
                    placeholder="ask about the architecture, a function, a bug…"
                    className="max-h-32 min-h-[38px] flex-1 resize-none bg-transparent py-2 text-[13px] text-foreground placeholder:text-dim focus:outline-none"
                  />
                  {streaming ? (
                    <button
                      type="button"
                      onClick={stop}
                      className="mb-0.5 flex size-8 items-center justify-center border border-border text-muted transition-colors hover:border-danger hover:text-danger"
                    >
                      <Square className="size-3 fill-current" />
                    </button>
                  ) : (
                    <button
                      type="submit"
                      disabled={!input.trim()}
                      className="mb-0.5 flex size-8 items-center justify-center border border-accent bg-accent text-[#0a0b0c] transition-colors hover:bg-accent-dim disabled:cursor-not-allowed disabled:border-border disabled:bg-surface-2 disabled:text-dim"
                    >
                      <ArrowUp className="size-3.5" />
                    </button>
                  )}
                </form>
                <p className="mt-2 text-[10.5px] text-dim">
                  enter to send · shift+enter for newline · answers cite indexed
                  chunks only
                </p>
              </div>
            </div>
          </div>

          {/* Sources rail */}
          <aside className="hidden min-h-0 flex-col overflow-y-auto bg-surface/30 lg:flex">
            <div className="sticky top-0 border-b border-border bg-background/90 px-5 py-3 backdrop-blur">
              <span className="label">sources · latest answer</span>
            </div>
            <div className="space-y-2 p-4">
              {activeSources.length === 0 && (
                <p className="px-1 py-6 text-[11.5px] leading-relaxed text-dim">
                  Citations appear here the moment retrieval settles — before
                  the answer starts typing. Click one to preview the file at the
                  cited lines.
                </p>
              )}
              {activeSources.map((source, index) => (
                <motion.div
                  key={`${source.path}:${source.startLine}`}
                  initial={{ opacity: 0, x: 8 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.05 }}
                >
                  <SourceBadge
                    source={source}
                    githubHref={hrefFor(source)}
                    onOpen={() => setPreview(source)}
                  />
                </motion.div>
              ))}
            </div>
          </aside>
        </div>
      </div>

      <SourcePreview
        repoId={id}
        owner={owner}
        name={name}
        branch={branch}
        source={preview}
        onOpenChange={(open) => !open && setPreview(null)}
      />
    </div>
  )
}
