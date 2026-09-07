import type { Highlighter } from "shiki";

/**
 * Lazily-created Shiki highlighter shared by every code surface (chat blocks + file preview).
 * Loading is deferred so the landing page never pays for the grammar bundle.
 */
let instance: Promise<Highlighter> | null = null;

const LANGS = [
  "typescript",
  "tsx",
  "javascript",
  "jsx",
  "json",
  "bash",
  "python",
  "go",
  "rust",
  "sql",
  "yaml",
  "markdown",
] as const;

const ALIASES: Record<string, string> = {
  ts: "typescript",
  js: "javascript",
  py: "python",
  sh: "bash",
  shell: "bash",
  yml: "yaml",
  md: "markdown",
  text: "typescript",
  "": "typescript",
};

export function normalizeLang(lang?: string) {
  const key = (lang ?? "").toLowerCase();
  const mapped = ALIASES[key] ?? key;
  return (LANGS as readonly string[]).includes(mapped) ? mapped : "typescript";
}

export function getHighlighter() {
  if (!instance) {
    instance = import("shiki").then((shiki) =>
      shiki.createHighlighter({
        themes: ["vitesse-dark"],
        langs: [...LANGS],
      }),
    );
  }
  return instance;
}

export async function highlight(code: string, lang?: string) {
  const highlighter = await getHighlighter();
  return highlighter.codeToHtml(code, {
    lang: normalizeLang(lang),
    theme: "vitesse-dark",
  });
}
