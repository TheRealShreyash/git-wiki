import { inngest } from "../client.js";
import { fetchRepoFiles } from "../../service/github.js";
import { chunkFiles } from "../../service/chunker.js";
import { saveChunks } from "../../service/vectorStore.js";

export const indexRepo = inngest.createFunction(
  { id: "index-repo", triggers: [{ event: "repo/index.request" }] },
  async ({ event, step }) => {
    const { githubToken, owner, repo } = event.data;

    const repoName = repo.replace(/\.git$/, "");
    const repoKey = `${owner}/${repoName}`;

    return await step.run("index-repository-pipeline", async () => {
      console.log(`[Inngest] Starting repository indexing for ${repoKey}...`);

      // 1. Fetch files from GitHub
      const files = await fetchRepoFiles(githubToken, owner, repoName);
      console.log(`[Inngest] Fetched ${files ? files.length : 0} files.`);

      if (!files || files.length === 0) {
        return {
          repo: repoKey,
          fileCount: 0,
          chunkCount: 0,
          message: "No indexable files found.",
        };
      }

      // 2. Chunk repository files
      const documents = await chunkFiles(files, repoKey);
      console.log(
        `[Inngest] Generated ${documents ? documents.length : 0} document chunks.`,
      );

      // 3. Save chunks into Pinecone vector store
      if (documents && documents.length > 0) {
        await saveChunks(repoKey, documents);
        console.log(
          `[Inngest] Successfully indexed chunks in Pinecone namespace "${repoKey}".`,
        );
      }

      return {
        repo: repoKey,
        fileCount: files.length,
        chunkCount: documents ? documents.length : 0,
      };
    });
  },
);
