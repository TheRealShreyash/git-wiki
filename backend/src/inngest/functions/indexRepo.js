import { inngest } from "../client.js";
import { fetchRepoFiles } from "../../service/github.js";
import { chunkFiles } from "../../service/chunker.js";
import { saveChunks } from "../../service/vectorStore.js";
import { updateRepoProgress, appendLog, upsertFileMeta } from "../../db/index.js";

const LANGUAGE_BY_EXT = {
  ts: "TypeScript",
  tsx: "TypeScript",
  js: "JavaScript",
  jsx: "JavaScript",
  py: "Python",
  go: "Go",
  rs: "Rust",
  rb: "Ruby",
  java: "Java",
  kt: "Kotlin",
  c: "C",
  h: "C",
  cpp: "C++",
  hpp: "C++",
  cs: "C#",
  php: "PHP",
  swift: "Swift",
};

/** Picks the most common language among crawled files by extension — cheap and real, no guesswork API. */
function detectLanguage(files) {
  const counts = {};
  for (const file of files) {
    const ext = file.path.split(".").pop()?.toLowerCase();
    const lang = LANGUAGE_BY_EXT[ext];
    if (lang) counts[lang] = (counts[lang] || 0) + 1;
  }
  const [top] = Object.entries(counts).sort((a, b) => b[1] - a[1]);
  return top?.[0] || "Other";
}

export const indexRepo = inngest.createFunction(
  { id: "index-repo", triggers: [{ event: "repo/index.request" }] },
  async ({ event, step }) => {
    const { githubToken, owner, repo } = event.data;

    const repoName = repo.replace(/\.git$/, "");
    const repoKey = `${owner}/${repoName}`;
    const startedAt = Date.now();

    return await step.run("index-repository-pipeline", async () => {
      try {
        console.log(`[Inngest] Starting repository indexing for ${repoKey}...`);
        updateRepoProgress(repoKey, { status: "crawling" });
        appendLog(repoKey, "step", "Crawling repository tree...");

        // 1. Fetch files from GitHub
        const files = await fetchRepoFiles(githubToken, owner, repoName);
        console.log(`[Inngest] Fetched ${files ? files.length : 0} files.`);

        if (!files || files.length === 0) {
          updateRepoProgress(repoKey, {
            status: "error",
            errorMessage: "No indexable files found.",
            durationMs: Date.now() - startedAt,
          });
          appendLog(repoKey, "warn", "No indexable files found.");
          return {
            repo: repoKey,
            fileCount: 0,
            chunkCount: 0,
            message: "No indexable files found.",
          };
        }

        for (const file of files) {
          upsertFileMeta(repoKey, file.path, file.sha, file.size);
        }

        updateRepoProgress(repoKey, {
          status: "chunking",
          totalFiles: files.length,
          language: detectLanguage(files),
        });
        appendLog(repoKey, "ok", `Crawled ${files.length} files.`);

        // 2. Chunk repository files
        const documents = await chunkFiles(files, repoKey);
        const chunkCount = documents ? documents.length : 0;
        console.log(`[Inngest] Generated ${chunkCount} document chunks.`);

        updateRepoProgress(repoKey, {
          status: "embedding",
          totalChunks: chunkCount,
          totalBatches: Math.ceil(chunkCount / 30),
        });
        appendLog(repoKey, "ok", `Generated ${chunkCount} chunks.`);

        // 3. Save chunks into Pinecone vector store
        if (documents && documents.length > 0) {
          await saveChunks(repoKey, documents, undefined, ({ batch, totalBatches, embedded }) => {
            updateRepoProgress(repoKey, { embeddedBatches: batch, totalBatches });
            appendLog(repoKey, "step", `Embedded batch ${batch}/${totalBatches} (${embedded} chunks)...`);
          });
          console.log(
            `[Inngest] Successfully indexed chunks in Pinecone namespace "${repoKey}".`,
          );
        }

        updateRepoProgress(repoKey, {
          status: "ready",
          progress: 1,
          durationMs: Date.now() - startedAt,
        });
        appendLog(repoKey, "ok", "Indexing complete.");

        return {
          repo: repoKey,
          fileCount: files.length,
          chunkCount,
        };
      } catch (error) {
        console.error(`[Inngest] Indexing failed for ${repoKey}:`, error);
        updateRepoProgress(repoKey, {
          status: "error",
          errorMessage: error.message,
          durationMs: Date.now() - startedAt,
        });
        appendLog(repoKey, "warn", `Failed: ${error.message}`);
        throw error;
      }
    });
  },
);
