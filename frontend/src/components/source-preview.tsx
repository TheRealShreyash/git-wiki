import * as Dialog from "@radix-ui/react-dialog";
import { ExternalLink, Loader2, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import type { SourceCitation } from "../lib/backend";
import { githubLineUrl } from "../lib/backend";
import { getHighlighter, normalizeLang } from "../lib/highlighter";
import { useRepoFile } from "../queries/repos";

type Props = {
  repoId: string;
  owner: string;
  name: string;
  branch: string;
  source: SourceCitation | null;
  onOpenChange: (open: boolean) => void;
};

/**
 * Full-file preview with the cited line range highlighted, rendered line-by-line so the
 * citation window can be visually isolated and scrolled to.
 */
export function SourcePreview({ repoId, owner, name, branch, source, onOpenChange }: Props) {
  const file = useRepoFile(repoId, source?.path ?? null);
  const [lines, setLines] = useState<string[] | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let alive = true;
    if (!file.data) {
      setLines(null);
      return;
    }
    getHighlighter().then((highlighter) => {
      if (!alive || !file.data) return;
      const html = highlighter.codeToHtml(file.data.content, {
        lang: normalizeLang(file.data.lang),
        theme: "vitesse-dark",
      });
      const body = html.match(/<code[^>]*>([\s\S]*)<\/code>/)?.[1] ?? "";
      setLines(body.split(/(?=<span class="line")/).filter(Boolean));
    });
    return () => {
      alive = false;
    };
  }, [file.data]);

  useEffect(() => {
    if (!lines || !source) return;
    const timer = setTimeout(() => {
      const target = scrollRef.current?.querySelector<HTMLElement>("[data-cited='start']");
      target?.scrollIntoView({ block: "center" });
    }, 40);
    return () => clearTimeout(timer);
  }, [lines, source]);

  const githubHref = source
    ? githubLineUrl(owner, name, branch, source.path, source.startLine, source.endLine)
    : "#";

  return (
    <Dialog.Root open={Boolean(source)} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-background/85 backdrop-blur-sm data-[state=open]:animate-in data-[state=open]:fade-in-0" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-50 flex h-[82vh] w-[min(1040px,94vw)] -translate-x-1/2 -translate-y-1/2 flex-col border border-border-strong bg-surface shadow-2xl data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95">
          <div className="flex items-center gap-4 border-b border-border px-5 py-3.5">
            <div className="min-w-0 flex-1">
              <Dialog.Title className="truncate text-[13px] font-medium text-foreground">
                {source?.path}
              </Dialog.Title>
              <Dialog.Description className="mt-1 text-[11px] text-dim">
                lines {source?.startLine}–{source?.endLine} · similarity{" "}
                {source ? source.score.toFixed(2) : "—"} · {owner}/{name}@{branch}
              </Dialog.Description>
            </div>

            <a
              href={githubHref}
              target="_blank"
              rel="noreferrer"
              className="flex h-8 shrink-0 items-center gap-2 border border-border px-3 text-[11px] uppercase tracking-[0.12em] text-muted transition-colors hover:border-accent hover:text-accent"
            >
              open on github <ExternalLink className="size-3" />
            </a>

            <Dialog.Close className="flex size-8 shrink-0 items-center justify-center border border-border text-dim transition-colors hover:border-border-strong hover:text-foreground">
              <X className="size-3.5" />
            </Dialog.Close>
          </div>

          <div ref={scrollRef} className="flex-1 overflow-auto bg-[#121212] py-3">
            {file.isLoading || !lines ? (
              <div className="flex h-full items-center justify-center gap-2.5 text-[12px] text-dim">
                <Loader2 className="size-3.5 animate-spin" /> loading file…
              </div>
            ) : (
              <div className="min-w-fit font-mono text-[12.5px] leading-[1.6]">
                {lines.map((line, index) => {
                  const number = index + 1;
                  const cited =
                    source && number >= source.startLine && number <= source.endLine;
                  return (
                    <div
                      key={number}
                      data-cited={cited && number === source?.startLine ? "start" : undefined}
                      className={cn(
                        "flex gap-4 px-4",
                        cited && "bg-accent/[0.07] border-l-2 border-accent -ml-0.5",
                      )}
                    >
                      <span
                        className={cn(
                          "w-10 shrink-0 select-none text-right tabular-nums",
                          cited ? "text-accent/70" : "text-dim/60",
                        )}
                      >
                        {number}
                      </span>
                      <span
                        className="whitespace-pre"
                        dangerouslySetInnerHTML={{ __html: line }}
                      />
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
