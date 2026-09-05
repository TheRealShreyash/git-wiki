import { Router } from "express";
import {
  askQuestion,
  executeAskQuestion,
  streamQuestion,
} from "../service/rag.js";
import { parseRepoUrl } from "../service/github.js";

const chatRoutes = Router();

/**
 * Helper to normalize repository identifier from body or URL.
 */
function resolveRepoKey(body = {}) {
  let { owner, repo, url } = body;

  if (url && (!owner || !repo)) {
    try {
      const parsed = parseRepoUrl(url);
      owner = parsed.owner;
      repo = parsed.repo;
    } catch {
      // Fall through to manual check
    }
  }

  if (owner && repo && !repo.includes("/")) {
    return `${owner}/${repo.replace(/\.git$/, "")}`;
  }

  if (repo) {
    return repo.replace(/\.git$/, "");
  }

  return null;
}

/**
 * POST /api/chat
 * Ask a question about an indexed repository.
 *
 * Body parameters:
 * - question (string, required): The query or question. (aliases: query, message)
 * - repo (string): Repository identifier (e.g. "owner/repo" or repository name)
 * - owner (string, optional): Repository owner if repo is just repo name
 * - url (string, optional): Full GitHub URL (e.g. "https://github.com/owner/repo")
 * - k (number, optional): Number of vector chunks to retrieve (default: 5)
 * - async (boolean, optional): If true, dispatches as an Inngest background job. Default: false.
 */
chatRoutes.post("/", async (req, res) => {
  try {
    const {
      question,
      query,
      message,
      k = 5,
      async: isAsync = false,
      modelName,
    } = req.body || {};
    const q = question || query || message;

    if (!q || typeof q !== "string" || !q.trim()) {
      return res.status(400).json({
        error:
          "Missing required parameter: 'question' must be a non-empty string.",
      });
    }

    const repoKey = resolveRepoKey(req.body);
    if (!repoKey) {
      return res.status(400).json({
        error:
          "Missing required repository information: provide 'repo', 'owner' + 'repo', or 'url'.",
      });
    }

    // Background asynchronous processing via Inngest
    if (isAsync || req.query.async === "true") {
      const response = await askQuestion(q.trim(), repoKey, {
        k: Number(k),
        modelName,
      });
      return res.status(202).json(response);
    }

    // Direct synchronous question answering
    const response = await executeAskQuestion(q.trim(), repoKey, {
      k: Number(k),
      modelName,
    });
    return res.status(200).json(response);
  } catch (error) {
    console.error("[chat.routes] Error answering question:", error);
    return res.status(500).json({
      error:
        error.message || "An error occurred while answering your question.",
    });
  }
});

/**
 * POST /api/chat/queue
 * Explicitly queues the question for background processing via Inngest.
 */
chatRoutes.post("/queue", async (req, res) => {
  try {
    const { question, query, message, k = 5, modelName } = req.body || {};
    const q = question || query || message;

    if (!q || typeof q !== "string" || !q.trim()) {
      return res.status(400).json({
        error:
          "Missing required parameter: 'question' must be a non-empty string.",
      });
    }

    const repoKey = resolveRepoKey(req.body);
    if (!repoKey) {
      return res.status(400).json({
        error:
          "Missing required repository information: provide 'repo', 'owner' + 'repo', or 'url'.",
      });
    }

    const response = await askQuestion(q.trim(), repoKey, {
      k: Number(k),
      modelName,
    });
    return res.status(202).json(response);
  } catch (error) {
    console.error("[chat.routes] Error queuing question:", error);
    return res.status(500).json({
      error: error.message || "Failed to queue question for processing.",
    });
  }
});

/**
 * POST /api/chat/stream
 * Streams the generated response using Server-Sent Events (SSE).
 */
chatRoutes.post("/stream", async (req, res) => {
  try {
    const { question, query, message, k = 5, modelName } = req.body || {};
    const q = question || query || message;

    if (!q || typeof q !== "string" || !q.trim()) {
      return res.status(400).json({
        error:
          "Missing required parameter: 'question' must be a non-empty string.",
      });
    }

    const repoKey = resolveRepoKey(req.body);
    if (!repoKey) {
      return res.status(400).json({
        error:
          "Missing required repository information: provide 'repo', 'owner' + 'repo', or 'url'.",
      });
    }

    const { stream, sources } = await streamQuestion(q.trim(), repoKey, {
      k: Number(k),
      modelName,
    });

    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");

    // Send sources metadata first
    res.write(`event: sources\ndata: ${JSON.stringify(sources)}\n\n`);

    // Stream text chunks
    for await (const chunk of stream) {
      res.write(`data: ${JSON.stringify({ token: chunk })}\n\n`);
    }

    res.write(`event: done\ndata: {}\n\n`);
    res.end();
  } catch (error) {
    console.error("[chat.routes] Error streaming response:", error);
    if (!res.headersSent) {
      return res.status(500).json({
        error: error.message || "Failed to stream answer.",
      });
    }
    res.end();
  }
});

export default chatRoutes;
