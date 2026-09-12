import { PrismaClient } from "@prisma/client";

export const prisma = new PrismaClient();

/** Stages shown by the tracker UI, in pipeline order. */
export const STAGES = ["crawl", "chunk", "embed", "done"];

function stageProgress(status) {
  switch (status) {
    case "queued":
      return 0;
    case "crawling":
      return 0.05;
    case "chunking":
      return 0.3;
    case "embedding":
      return 0.5;
    case "ready":
      return 1;
    case "error":
      return 1;
    default:
      return 0;
  }
}

/** Converts DateTime columns to plain ms-epoch numbers so callers never deal with Date/bigint. */
function serializeRepo(repo) {
  if (!repo) return null;
  return {
    ...repo,
    startedAt: repo.startedAt.getTime(),
    updatedAt: repo.updatedAt.getTime(),
    logs: Array.isArray(repo.logs) ? repo.logs : [],
  };
}

export async function upsertRepo(repo) {
  const existing = await prisma.repo.findUnique({ where: { id: repo.id } });

  if (existing) {
    const updated = await prisma.repo.update({
      where: { id: repo.id },
      data: {
        owner: repo.owner,
        name: repo.name,
        url: repo.url,
        isPrivate: Boolean(repo.isPrivate),
        eventId: repo.eventId ?? null,
        githubToken: repo.githubToken ?? null,
        status: "queued",
        progress: 0,
        errorMessage: null,
        logs: [],
        startedAt: new Date(),
      },
    });
    return serializeRepo(updated);
  }

  const created = await prisma.repo.create({
    data: {
      id: repo.id,
      owner: repo.owner,
      name: repo.name,
      url: repo.url,
      branch: repo.branch ?? "main",
      isPrivate: Boolean(repo.isPrivate),
      eventId: repo.eventId ?? null,
      githubToken: repo.githubToken ?? null,
      status: "queued",
      progress: 0,
      startedAt: new Date(),
    },
  });
  return serializeRepo(created);
}

export async function updateRepoProgress(id, patch) {
  const current = await prisma.repo.findUnique({ where: { id } });
  if (!current) return null;

  const next = { ...current, ...patch };
  const progress = patch.progress ?? stageProgress(next.status);

  const updated = await prisma.repo.update({
    where: { id },
    data: {
      status: next.status,
      progress,
      branch: next.branch,
      language: next.language ?? null,
      totalFiles: next.totalFiles ?? 0,
      totalChunks: next.totalChunks ?? 0,
      embeddedBatches: next.embeddedBatches ?? 0,
      totalBatches: next.totalBatches ?? 0,
      errorMessage: next.errorMessage ?? null,
      durationMs: next.durationMs ?? null,
    },
  });

  return serializeRepo(updated);
}

export async function appendLog(id, level, text) {
  const current = await prisma.repo.findUnique({ where: { id } });
  if (!current) return;
  const logs = Array.isArray(current.logs) ? current.logs : [];
  logs.push({ at: Date.now(), level, text });
  await prisma.repo.update({
    where: { id },
    data: { logs: logs.slice(-200) },
  });
}

export async function getRepo(id) {
  const repo = await prisma.repo.findUnique({ where: { id } });
  return serializeRepo(repo);
}

export async function listRepos() {
  const rows = await prisma.repo.findMany({ orderBy: { startedAt: "desc" } });
  return rows.map(serializeRepo);
}

export async function addMessage(repoId, role, content, sources = []) {
  await prisma.message.create({
    data: { repoId, role, content, sources },
  });
}

export async function listMessages(repoId) {
  const rows = await prisma.message.findMany({
    where: { repoId },
    orderBy: { createdAt: "asc" },
  });
  return rows.map((row) => ({
    id: String(row.id),
    role: row.role,
    content: row.content,
    sources: row.sources ?? [],
    createdAt: row.createdAt.getTime(),
  }));
}

export async function clearMessages(repoId) {
  await prisma.message.deleteMany({ where: { repoId } });
}

export async function upsertFileMeta(repoId, path, sha, size) {
  await prisma.repoFile.upsert({
    where: { repoId_path: { repoId, path } },
    create: { repoId, path, sha: sha ?? null, size: size ?? null },
    update: { sha: sha ?? null, size: size ?? null },
  });
}

export async function getFileMeta(repoId, path) {
  return prisma.repoFile.findUnique({ where: { repoId_path: { repoId, path } } });
}
