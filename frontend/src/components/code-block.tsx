import { Check, Copy } from 'lucide-react'
import { useEffect, useState } from 'react'
import { cn } from '@/lib/utils'
import { highlight } from '../lib/highlighter'

export function CodeBlock({
  code,
  lang,
  filename,
  className,
}: {
  code: string
  lang?: string
  filename?: string
  className?: string
}) {
  const [html, setHtml] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    let alive = true
    highlight(code, lang).then((result) => {
      if (alive) setHtml(result)
    })
    return () => {
      alive = false
    }
  }, [code, lang])

  const copy = () => {
    navigator.clipboard.writeText(code)
    setCopied(true)
    setTimeout(() => setCopied(false), 1400)
  }

  return (
    <div
      className={cn(
        'group relative my-3 border border-border bg-surface-2',
        className,
      )}
    >
      <div className="flex items-center justify-between border-b border-border px-3 py-1.5">
        <span className="label truncate">{filename ?? lang ?? 'code'}</span>
        <button
          type="button"
          onClick={copy}
          className="flex items-center gap-1.5 text-[10px] uppercase tracking-[0.14em] text-dim transition-colors hover:text-accent"
        >
          {copied ? <Check className="size-3" /> : <Copy className="size-3" />}
          {copied ? 'copied' : 'copy'}
        </button>
      </div>
      {html ? (
        <div
          className="shiki-block"
          dangerouslySetInnerHTML={{ __html: html }}
        />
      ) : (
        <pre className="overflow-x-auto px-4 py-3.5 text-[12.5px] leading-[1.65] text-muted">
          <code>{code}</code>
        </pre>
      )}
    </div>
  )
}
