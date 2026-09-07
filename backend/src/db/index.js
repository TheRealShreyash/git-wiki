import { Database } from "bun:sqlite";
import { existsSync, mkdirSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const DB_PATH = join(__dirname, "..", "..", "data.sqlite");

if (!existsSync(dirname(DB_PATH))) {
  mkdirSync(dirname(DB_PATH), { recursive: true });
}

export const db = new Database(DB_PATH);
db.exec("PRAGMA journal_mode = WAL;");
db.exec("PRAGMA synchronous = NORMAL;");

db.exec(`
  CREATE TABLE IF NOT EXISTS repos (
    id TEXT PRIMARY KEY,
    owner TEXT NOT NULL,
    name TEXT NOT NULL,
    url TEXT NOT NULL,
    branch TEXT NOT NULL DEFAULT 'main',
    isPrivate INTEGER NOT NULL DEFAULT 0,
    language TEXT,
    totalFiles INTEGER NOT NULL DEFAULT 0,
    totalChunks INTEGER NOT NULL DEFAULT 0,
    embeddedBatches INTEGER NOT NULL DEFAULT 0,
    totalBatches INTEGER NOT NULL DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'queued',
    progress REAL NOT NULL DEFAULT 0,
    eventId TEXT,
    githubToken TEXT,
    logs TEXT NOT NULL DEFAULT '[]',
    errorMessage TEXT,
    startedAt INTEGER NOT NULL,
    updatedAt INTEGER NOT NULL,
    durationMs INTEGER
  );
`);

db.exec(`
  CREATE TABLE IF NOT EXISTS messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    repoId TEXT NOT NULL,
    role TEXT NOT NULL,
    content TEXT NOT NULL,
    sources TEXT NOT NULL DEFAULT '[]',
    createdAt INTEGER NOT NULL
  );
`);
db.exec(`CREATE INDEX IF NOT EXISTS idx_messages_repoId ON messages (repoId);`);

db.exec(`
  CREATE TABLE IF NOT EXISTS files (
    repoId TEXT NOT NULL,
    path TEXT NOT NULL,
    sha TEXT,
    size INTEGER,
    PRIMARY KEY (repoId, path)
  );
`);

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

export function upsertRepo(repo) {
  const now = Date.now();
  const existing = getRepo(repo.id);
  if (existing) {
    db.query(
      `UPDATE repos SET owner=$owner, name=$name, url=$url, isPrivate=$isPrivate,
       eventId=$eventId, githubToken=$githubToken, status='queued', progress=0,
       errorMessage=NULL, logs='[]', startedAt=$startedAt, updatedAt=$updatedAt
       WHERE id=$id`,
    ).run({
      $id: repo.id,
      $owner: repo.owner,
      $name: repo.name,
      $url: repo.url,
      $isPrivate: repo.isPrivate ? 1 : 0,
      $eventId: repo.eventId ?? null,
      $githubToken: repo.githubToken ?? null,
      $startedAt: now,
      $updatedAt: now,
    });
    return getRepo(repo.id);
  }

  db.query(
    `INSERT INTO repos (id, owner, name, url, branch, isPrivate, eventId, githubToken, status, progress, startedAt, updatedAt)
     VALUES ($id, $owner, $name, $url, $branch, $isPrivate, $eventId, $githubToken, 'queued', 0, $startedAt, $updatedAt)`,
  ).run({
    $id: repo.id,
    $owner: repo.owner,
    $name: repo.name,
    $url: repo.url,
    $branch: repo.branch ?? "main",
    $isPrivate: repo.isPrivate ? 1 : 0,
    $eventId: repo.eventId ?? null,
    $githubToken: repo.githubToken ?? null,
    $startedAt: now,
    $updatedAt: now,
  });
  return getRepo(repo.id);
}

export function updateRepoProgress(id, patch) {
  const current = getRepo(id);
  if (!current) return null;

  const next = { ...current, ...patch };
  const progress = patch.progress ?? stageProgress(next.status);

  db.query(
    `UPDATE repos SET
       status=$status, progress=$progress, branch=$branch, language=$language,
       totalFiles=$totalFiles, totalChunks=$totalChunks, embeddedBatches=$embeddedBatches,
       totalBatches=$totalBatches, errorMessage=$errorMessage, durationMs=$durationMs,
       updatedAt=$updatedAt
     WHERE id=$id`,
  ).run({
    $id: id,
    $status: next.status,
    $progress: progress,
    $branch: next.branch,
    $language: next.language ?? null,
    $totalFiles: next.totalFiles ?? 0,
    $totalChunks: next.totalChunks ?? 0,
    $embeddedBatches: next.embeddedBatches ?? 0,
    $totalBatches: next.totalBatches ?? 0,
    $errorMessage: next.errorMessage ?? null,
    $durationMs: next.durationMs ?? null,
    $updatedAt: Date.now(),
  });

  return getRepo(id);
}

export function appendLog(id, level, text) {
  const current = getRepo(id);
  if (!current) return;
  const logs = current.logs;
  logs.push({ at: Date.now(), level, text });
  db.query(`UPDATE repos SET logs=$logs, updatedAt=$updatedAt WHERE id=$id`).run({
    $id: id,
    $logs: JSON.stringify(logs.slice(-200)),
    $updatedAt: Date.now(),
  });
}

export function getRepo(id) {
  const row = db.query(`SELECT * FROM repos WHERE id = $id`).get({ $id: id });
  if (!row) return null;
  return {
    ...row,
    isPrivate: Boolean(row.isPrivate),
    logs: JSON.parse(row.logs || "[]"),
  };
}

export function listRepos() {
  const rows = db.query(`SELECT * FROM repos ORDER BY startedAt DESC`).all();
  return rows.map((row) => ({
    ...row,
    isPrivate: Boolean(row.isPrivate),
    logs: JSON.parse(row.logs || "[]"),
  }));
}

export function addMessage(repoId, role, content, sources = []) {
  db.query(
    `INSERT INTO messages (repoId, role, content, sources, createdAt) VALUES ($repoId, $role, $content, $sources, $createdAt)`,
  ).run({
    $repoId: repoId,
    $role: role,
    $content: content,
    $sources: JSON.stringify(sources),
    $createdAt: Date.now(),
  });
}

export function listMessages(repoId) {
  const rows = db
    .query(`SELECT * FROM messages WHERE repoId = $repoId ORDER BY createdAt ASC`)
    .all({ $repoId: repoId });
  return rows.map((row) => ({
    id: String(row.id),
    role: row.role,
    content: row.content,
    sources: JSON.parse(row.sources || "[]"),
    createdAt: row.createdAt,
  }));
}

export function clearMessages(repoId) {
  db.query(`DELETE FROM messages WHERE repoId = $repoId`).run({ $repoId: repoId });
}

export function upsertFileMeta(repoId, path, sha, size) {
  db.query(
    `INSERT INTO files (repoId, path, sha, size) VALUES ($repoId, $path, $sha, $size)
     ON CONFLICT(repoId, path) DO UPDATE SET sha=excluded.sha, size=excluded.size`,
  ).run({ $repoId: repoId, $path: path, $sha: sha ?? null, $size: size ?? null });
}

export function getFileMeta(repoId, path) {
  return db
    .query(`SELECT * FROM files WHERE repoId = $repoId AND path = $path`)
    .get({ $repoId: repoId, $path: path });
}
