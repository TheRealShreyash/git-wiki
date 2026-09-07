/**
 * Single swap point for the real backend.
 *
 * Today the app talks to the bundled mock (same origin). To point it at the production
 * indexing service, set VITE_API_BASE in the root .env — the streaming client below and the
 * oRPC hooks in src/web/queries/repos.ts already speak the documented contract:
 *
 *   POST /api/index                 { url, githubToken? }  -> 202 { message, eventId, owner, repo }
 *   GET  /api/index/status/:eventId                        -> { status, stages, ... }
 *   POST /api/chat/stream           { repoId, question }   -> SSE: sources | token | done
 */
export const API_BASE = import.meta.env.VITE_API_BASE ?? "";

export type SourceCitation = {
  path: string;
  startLine: number;
  endLine: number;
  score: number;
  snippet: string;
};

export type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  sources: SourceCitation[];
  createdAt: number;
  streaming?: boolean;
};

export function githubLineUrl(
  owner: string,
  repo: string,
  branch: string,
  path: string,
  startLine?: number,
  endLine?: number,
) {
  const base = `https://github.com/${owner}/${repo}/blob/${branch}/${path}`;
  if (!startLine) return base;
  return `${base}#L${startLine}${endLine && endLine !== startLine ? `-L${endLine}` : ""}`;
}

type StreamHandlers = {
  onSources?: (sources: SourceCitation[]) => void;
  onToken?: (token: string) => void;
  onDone?: (payload: { id: string }) => void;
  onError?: (error: Error) => void;
};

/**
 * Reads a `text/event-stream` response with fetch (not EventSource — the endpoint is POST).
 * Handles multi-line `data:` fields and tolerates chunk boundaries splitting an event.
 */
export async function streamChat(
  input: { repoId: string; question: string },
  handlers: StreamHandlers,
  signal?: AbortSignal,
) {
  try {
    const response = await fetch(`${API_BASE}/api/chat/stream`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "text/event-stream" },
      body: JSON.stringify({ repo: input.repoId, question: input.question }),
      signal,
    });

    if (!response.ok || !response.body) {
      throw new Error(`Stream failed with ${response.status}`);
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });

      const frames = buffer.split("\n\n");
      buffer = frames.pop() ?? "";

      for (const frame of frames) {
        if (!frame.trim()) continue;
        let event = "message";
        const dataLines: string[] = [];

        for (const line of frame.split("\n")) {
          if (line.startsWith("event:")) event = line.slice(6).trim();
          else if (line.startsWith("data:")) dataLines.push(line.slice(5).replace(/^ /, ""));
        }

        const data = dataLines.join("\n");
        if (!data) continue;

        if (event === "token") {
          handlers.onToken?.(safeParse<string>(data) ?? data);
        } else if (event === "sources") {
          handlers.onSources?.(safeParse<SourceCitation[]>(data) ?? []);
        } else if (event === "done") {
          handlers.onDone?.(safeParse<{ id: string }>(data) ?? { id: "" });
        }
      }
    }
  } catch (error) {
    if ((error as Error).name === "AbortError") return;
    handlers.onError?.(error as Error);
  }
}

function safeParse<T>(value: string): T | null {
  try {
    return JSON.parse(value) as T;
  } catch {
    return null;
  }
}
