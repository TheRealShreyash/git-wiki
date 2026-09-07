import { Router } from "express";
import {
  getRepo,
  listRepos,
  getFileMeta,
  listMessages,
  clearMessages,
} from "../db/index.js";
import { fetchFileBlob } from "../service/github.js";
import { STAGES } from "../db/index.js";

const reposRoutes = Router();

const STAGE_LABELS = {
  crawl: "Crawling",
  chunk: "Chunking",
  embed: "Embedding",
  done: "Ready to chat",
};

const SUGGESTED_QUESTIONS = [
  "What does this repository do, in one paragraph?",
  "Where is the entry point and how does execution start?",
  "How is state managed across the app?",
  "What would break if I removed the biggest dependency?",
];

const LANG_BY_EXT = {
  ts: "typescript",
  tsx: "tsx",
  js: "javascript",
  jsx: "jsx",
  py: "python",
  go: "go",
  rs: "rust",
  rb: "ruby",
  java: "java",
  kt: "kotlin",
  md: "markdown",
  json: "json",
  yml: "yaml",
  yaml: "yaml",
  toml: "toml",
  sql: "sql",
  sh: "bash",
  css: "css",
  html: "html",
};

function langForPath(path) {
  const ext = path.split(".").pop()?.toLowerCase();
  return LANG_BY_EXT[ext] || "text";
}

/** Collapses the internal pipeline status into the coarse vocabulary the UI's StatusDot knows. */
function coarseStatus(status) {
  if (status === "ready") return "ready";
  if (status === "error") return "failed";
  if (status === "queued") return "queued";
  return "running"; // crawling | chunking | embedding
}

function toRow(repo) {
  return {
    id: repo.id,
    eventId: repo.eventId,
    owner: repo.owner,
    name: repo.name,
    slug: `${repo.owner}/${repo.name}`,
    url: repo.url,
    branch: repo.branch,
    isPrivate: repo.isPrivate,
    language: repo.language || "—",
    totalFiles: repo.totalFiles,
    totalChunks: repo.totalChunks,
    startedAt: repo.startedAt,
    durationMs: repo.durationMs,
    status: coarseStatus(repo.status),
    progress: repo.progress,
  };
}

/** GET /api/repos — every repo ever indexed. */
reposRoutes.get("/", (req, res) => {
  res.json(listRepos().map(toRow));
});

/** GET /api/repos/one?id=owner/repo — static repo info. */
reposRoutes.get("/one", (req, res) => {
  const repo = getRepo(req.query.id);
  if (!repo) return res.status(404).json({ error: "Repository not indexed" });
  res.json(toRow(repo));
});

/** GET /api/repos/status?id=owner/repo — live progress for the tracker page. */
reposRoutes.get("/status", (req, res) => {
  const repo = getRepo(req.query.id);
  if (!repo) return res.status(404).json({ error: "Repository not indexed" });

  const stages = STAGES.map((id) => {
    let status = "pending";
    let count = 0;
    let total = 0;

    if (id === "crawl") {
      total = repo.totalFiles;
      count = repo.totalFiles;
      status =
        repo.status === "queued"
          ? "pending"
          : repo.status === "crawling"
            ? "running"
            : "done";
    } else if (id === "chunk") {
      total = repo.totalChunks;
      count = repo.totalChunks;
      status =
        ["queued", "crawling"].includes(repo.status)
          ? "pending"
          : repo.status === "chunking"
            ? "running"
            : "done";
    } else if (id === "embed") {
      total = repo.totalBatches;
      count = repo.embeddedBatches;
      status =
        ["queued", "crawling", "chunking"].includes(repo.status)
          ? "pending"
          : repo.status === "embedding"
            ? "running"
            : ["ready", "error"].includes(repo.status)
              ? "done"
              : "pending";
    } else {
      total = 1;
      count = repo.status === "ready" ? 1 : 0;
      status = repo.status === "ready" ? "done" : "pending";
    }

    return {
      id,
      label: STAGE_LABELS[id],
      status,
      progress: total > 0 ? Math.min(1, count / total) : status === "done" ? 1 : 0,
      count,
      total,
      unit: id === "embed" ? "batches" : id === "chunk" ? "chunks" : "files",
    };
  });

  res.json({
    status: coarseStatus(repo.status),
    progress: repo.progress,
    stages,
    logs: repo.logs,
    eventId: repo.eventId,
    elapsedMs: repo.durationMs ?? Date.now() - repo.startedAt,
  });
});

/** GET /api/repos/file?id=owner/repo&path=src/index.ts — file content for the citation preview. */
reposRoutes.get("/file", async (req, res) => {
  try {
    const { id, path } = req.query;
    const repo = getRepo(id);
    if (!repo) return res.status(404).json({ error: "Repository not indexed" });

    const meta = getFileMeta(id, path);
    if (!meta || !meta.sha) {
      return res.status(404).json({ error: `${path} is not indexed` });
    }

    const content = await fetchFileBlob(repo.owner, repo.name, meta.sha, repo.githubToken);

    res.json({
      path,
      lang: langForPath(path),
      content,
      githubUrl: `https://github.com/${repo.owner}/${repo.name}/blob/${repo.branch}/${path}`,
    });
  } catch (error) {
    console.error("[repos.routes] Error fetching file:", error);
    res.status(500).json({ error: error.message || "Failed to fetch file content." });
  }
});

/** GET /api/repos/messages?id=owner/repo — chat history. */
reposRoutes.get("/messages", (req, res) => {
  res.json(listMessages(req.query.id));
});

/** DELETE /api/repos/messages?id=owner/repo — clear chat history. */
reposRoutes.delete("/messages", (req, res) => {
  clearMessages(req.query.id);
  res.json({ ok: true });
});

/** GET /api/repos/suggestions — example questions for a fresh chat. */
reposRoutes.get("/suggestions", (req, res) => {
  res.json(SUGGESTED_QUESTIONS);
});

export default reposRoutes;
