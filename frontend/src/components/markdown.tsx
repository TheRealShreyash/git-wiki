import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { CodeBlock } from './code-block'

/**
 * Answer renderer. Fenced blocks route through Shiki; inline code, tables and lists get
 * IDE-flavoured styling so streamed markdown stays readable mid-token.
 */
export function Markdown({ children }: { children: string }) {
  return (
    <div className="text-[13.5px] leading-[1.75] text-foreground/90">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          p: ({ children }) => (
            <p className="my-2.5 first:mt-0 last:mb-0">{children}</p>
          ),
          h1: ({ children }) => (
            <h1 className="font-display mt-5 mb-2 text-lg text-foreground">
              {children}
            </h1>
          ),
          h2: ({ children }) => (
            <h2 className="font-display mt-5 mb-2 text-base text-foreground">
              {children}
            </h2>
          ),
          h3: ({ children }) => (
            <h3 className="mt-4 mb-1.5 text-[13px] font-semibold tracking-wide text-foreground">
              {children}
            </h3>
          ),
          ul: ({ children }) => (
            <ul className="my-2.5 space-y-1.5 pl-4 [&>li]:relative [&>li]:pl-3.5">
              {children}
            </ul>
          ),
          ol: ({ children }) => (
            <ol className="my-2.5 list-decimal space-y-1.5 pl-6 marker:text-dim">
              {children}
            </ol>
          ),
          li: ({ children, ...props }) => (
            <li
              {...props}
              className="before:absolute before:left-0 before:top-[0.62em] before:size-1 before:bg-accent/70 [ol_&]:before:hidden [ol_&]:pl-0"
            >
              {children}
            </li>
          ),
          a: ({ children, href }) => (
            <a
              href={href}
              target="_blank"
              rel="noreferrer"
              className="text-info underline decoration-info/30 underline-offset-4 hover:decoration-info"
            >
              {children}
            </a>
          ),
          strong: ({ children }) => (
            <strong className="font-semibold text-foreground">
              {children}
            </strong>
          ),
          blockquote: ({ children }) => (
            <blockquote className="my-3 border-l-2 border-accent/40 pl-3 text-muted">
              {children}
            </blockquote>
          ),
          hr: () => <hr className="my-4 border-border" />,
          table: ({ children }) => (
            <div className="my-3 overflow-x-auto border border-border">
              <table className="w-full text-[12px]">{children}</table>
            </div>
          ),
          thead: ({ children }) => (
            <thead className="border-b border-border bg-surface-2 text-left">
              {children}
            </thead>
          ),
          th: ({ children }) => (
            <th className="px-3 py-2 text-[10px] uppercase tracking-[0.16em] text-dim">
              {children}
            </th>
          ),
          td: ({ children }) => (
            <td className="border-t border-border/60 px-3 py-2 align-top text-muted">
              {children}
            </td>
          ),
          code: ({ className, children, ...props }) => {
            const text = String(children ?? '').replace(/\n$/, '')
            const lang = /language-(\w+)/.exec(className ?? '')?.[1]
            const isBlock = Boolean(lang) || text.includes('\n')

            if (!isBlock) {
              return (
                <code
                  {...props}
                  className="border border-border/80 bg-surface-2 px-1.5 py-0.5 text-[12px] text-accent"
                >
                  {text}
                </code>
              )
            }
            return <CodeBlock code={text} lang={lang} />
          },
          pre: ({ children }) => <>{children}</>,
        }}
      >
        {children}
      </ReactMarkdown>
    </div>
  )
}
