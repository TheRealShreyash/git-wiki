import { Router } from "express";
import { inngest } from "../inngest/index.js";
import { parseRepoUrl } from "../service/github.js";
import { upsertRepo } from "../db/index.js";

const indexRoutes = Router();

/**
 * POST /api/index
 * Trigger background indexing of a GitHub repository via Inngest.
 *
 * Body parameters:
 * - url (optional): GitHub repository URL (e.g., https://github.com/owner/repo)
 * - owner (optional): Repository owner name
 * - repo (optional): Repository name
 * - githubToken (optional): GitHub Access Token (falls back to process.env.GITHUB_TOKEN)
 */
indexRoutes.post("/", async (req, res) => {
  try {
    let { owner, repo, url, githubToken } = req.body || {};

    const token =
      githubToken || process.env.githubToken || process.env.GITHUB_TOKEN;

    if (url && (!owner || !repo)) {
      const parsed = parseRepoUrl(url);
      owner = parsed.owner;
      repo = parsed.repo;
    }

    if (!owner || !repo) {
      return res.status(400).json({
        error:
          "Missing required parameters: 'owner' and 'repo' (or 'url') must be provided.",
      });
    }

    const repoName = repo.replace(/\.git$/, "");
    const repoId = `${owner}/${repoName}`;

    // Dispatch background event to Inngest
    const response = await inngest.send({
      name: "repo/index.request",
      data: {
        owner,
        repo: repoName,
        githubToken: token,
      },
    });

    const eventId = response.ids?.[0];

    await upsertRepo({
      id: repoId,
      owner,
      name: repoName,
      url: `https://github.com/${owner}/${repoName}`,
      isPrivate: Boolean(githubToken),
      eventId,
      githubToken: token,
    });

    return res.status(202).json({
      message: "Repository indexing request queued successfully.",
      eventId,
      owner,
      repo: repoName,
      id: repoId,
    });
  } catch (error) {
    console.error("Error queueing repository indexing:", error);
    return res.status(500).json({
      error: error.message || "Failed to process repository indexing request.",
    });
  }
});

export default indexRoutes;
