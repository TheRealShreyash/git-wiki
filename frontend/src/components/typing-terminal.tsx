import { useEffect, useState } from "react";

type Line = { kind: "prompt" | "out" | "ok" | "dim" | "answer"; text: string };

const SCRIPT: Line[] = [
  { kind: "prompt", text: "grepr index https://github.com/acme/orbit-api" },
  { kind: "dim", text: "202 queued · eventId 01M1HJ2RJESPYE4T3Q9B20JR0J" },
  { kind: "out", text: "crawl   ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓  1,284 files" },
  { kind: "out", text: "chunk   ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓ 11,902 chunks" },
  { kind: "out", text: "embed   ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓ 11,902 vectors" },
  { kind: "ok", text: "index ready in 26.4s" },
  { kind: "prompt", text: 'grepr ask "where do we handle webhook retries?"' },
  { kind: "answer", text: "Retries are handled in the Inngest step wrapper —" },
  { kind: "answer", text: "each failed delivery re-enqueues with exponential" },
  { kind: "answer", text: "backoff, capped at 6 attempts." },
  { kind: "dim", text: "src/queue/retry.ts:41-78 · src/routes/webhooks.ts:12-30" },
];

const COLORS: Record<Line["kind"], string> = {
  prompt: "text-foreground",
  out: "text-muted",
  ok: "text-accent",
  dim: "text-dim",
  answer: "text-foreground/80",
};

export function TypingTerminal() {
  const [lineIndex, setLineIndex] = useState(0);
  const [charIndex, setCharIndex] = useState(0);

  useEffect(() => {
    if (lineIndex >= SCRIPT.length) {
      const reset = setTimeout(() => {
        setLineIndex(0);
        setCharIndex(0);
      }, 4200);
      return () => clearTimeout(reset);
    }

    const line = SCRIPT[lineIndex];
    if (charIndex < line.text.length) {
      const speed = line.kind === "prompt" ? 26 : 7;
      const timer = setTimeout(() => setCharIndex((value) => value + 1), speed);
      return () => clearTimeout(timer);
    }

    const pause = line.kind === "prompt" ? 420 : line.kind === "ok" ? 620 : 130;
    const timer = setTimeout(() => {
      setLineIndex((value) => value + 1);
      setCharIndex(0);
    }, pause);
    return () => clearTimeout(timer);
  }, [lineIndex, charIndex]);

  const visible = SCRIPT.slice(0, lineIndex);
  const current = SCRIPT[lineIndex];

  return (
    <div className="border border-border bg-surface">
      <div className="flex items-center gap-2 border-b border-border px-3.5 py-2.5">
        <span className="size-2 rounded-full bg-border-strong" />
        <span className="size-2 rounded-full bg-border-strong" />
        <span className="size-2 rounded-full bg-border-strong" />
        <span className="label ml-2">grepr — zsh — 92×24</span>
      </div>
      <div className="h-[300px] overflow-hidden px-4 py-3.5 text-[12.5px] leading-[1.85]">
        {visible.map((line, index) => (
          <div key={`${line.text}-${index}`} className={COLORS[line.kind]}>
            {line.kind === "prompt" && <span className="mr-2 text-accent">❯</span>}
            <span className="whitespace-pre">{line.text}</span>
          </div>
        ))}
        {current && (
          <div className={COLORS[current.kind]}>
            {current.kind === "prompt" && <span className="mr-2 text-accent">❯</span>}
            <span className="whitespace-pre">{current.text.slice(0, charIndex)}</span>
            <span className="caret" />
          </div>
        )}
      </div>
    </div>
  );
}
