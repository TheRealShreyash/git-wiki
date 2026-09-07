import { API_BASE } from "./backend";

async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, {
    headers: { "Content-Type": "application/json" },
    ...init,
  });

  if (!response.ok) {
    const body = await response.json().catch(() => null);
    throw new Error(body?.error || `Request failed with ${response.status}`);
  }

  if (response.status === 204) return undefined as T;
  return response.json() as Promise<T>;
}

export type RepoRow = {
  id: string;
  eventId: string | null;
  owner: string;
  name: string;
  slug: string;
  url: string;
  branch: string;
  isPrivate: boolean;
  language: string;
  totalFiles: number;
  totalChunks: number;
  startedAt: number;
  durationMs: number | null;
  status: string;
  progress: number;
};

export type Stage = {
  id: string;
  label: string;
  status: string;
  progress: number;
  count: number;
  total: number;
  unit: string;
};

export type IndexStatus = {
  status: string;
  progress: number;
  stages: Stage[];
  logs: Array<{ at: number; level: string; text: string }>;
  eventId: string | null;
  elapsedMs: number;
};

export type RepoFile = {
  path: string;
  lang: string;
  content: string;
  githubUrl: string;
};

const q = (params: Record<string, string>) => `?${new URLSearchParams(params)}`;

export const api = {
  listRepos: () => apiFetch<RepoRow[]>("/api/repos"),
  getRepo: (id: string) => apiFetch<RepoRow>(`/api/repos/one${q({ id })}`),
  getStatus: (id: string) => apiFetch<IndexStatus>(`/api/repos/status${q({ id })}`),
  getFile: (id: string, path: string) =>
    apiFetch<RepoFile>(`/api/repos/file${q({ id, path })}`),
  getMessages: (id: string) =>
    apiFetch<
      Array<{
        id: string;
        role: "user" | "assistant";
        content: string;
        sources: Array<{
          path: string;
          startLine: number;
          endLine: number;
          score: number;
          snippet: string;
        }>;
        createdAt: number;
      }>
    >(`/api/repos/messages${q({ id })}`),
  clearMessages: (id: string) =>
    apiFetch<{ ok: true }>(`/api/repos/messages${q({ id })}`, { method: "DELETE" }),
  getSuggestions: () => apiFetch<string[]>("/api/repos/suggestions"),
  indexRepo: (input: { url: string; githubToken?: string }) =>
    apiFetch<{ message: string; eventId: string; owner: string; repo: string; id: string }>(
      "/api/index",
      { method: "POST", body: JSON.stringify(input) },
    ),
};
