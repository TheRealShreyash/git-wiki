import { GoogleGenerativeAIEmbeddings } from "@langchain/google-genai";
import { PineconeStore } from "@langchain/pinecone";
import { Pinecone } from "@pinecone-database/pinecone";
import { RecursiveCharacterTextSplitter } from "@langchain/textsplitters";
import { Document } from "@langchain/core/documents";
import dotenv from "dotenv";

dotenv.config();

export const TARGET_DIMENSION = parseInt(
  process.env.PINECONE_DIMENSION || "1024",
  10,
);

const googleApiKey =
  process.env.GEMINI_KEY ||
  process.env.GEMINI_API_KEY ||
  process.env.GOOGLE_API_KEY ||
  "placeholder";

export const embeddings = new GoogleGenerativeAIEmbeddings({
  model: "gemini-embedding-001",
  apiKey: googleApiKey,
});

export const pinecone = new Pinecone({
  apiKey: process.env.PINECONE_API_KEY || "placeholder",
});

export function getPineconeIndex(
  indexName = process.env.PINECONE_INDEX || "git-wiki",
) {
  return pinecone.Index(indexName);
}

/**
 * Adjusts an embedding vector to the target dimension using Matryoshka (MRL) slicing and L2 normalization.
 *
 * @param {number[]} vector
 * @param {number} [targetDim]
 * @returns {number[]}
 */
export function adjustDimension(vector, targetDim = TARGET_DIMENSION) {
  if (!vector || vector.length === targetDim) return vector;
  if (vector.length > targetDim) {
    const sliced = vector.slice(0, targetDim);
    const norm = Math.sqrt(sliced.reduce((sum, val) => sum + val * val, 0));
    return norm > 0 ? sliced.map((val) => val / norm) : sliced;
  }
  return [...vector, ...new Array(targetDim - vector.length).fill(0)];
}

/**
 * Sanitizes metadata to conform to Pinecone requirements:
 * only string, number, boolean, or list of strings are allowed.
 */
export function sanitizeMetadata(metadata) {
  const clean = {};
  if (!metadata || typeof metadata !== "object") return clean;

  for (const [key, value] of Object.entries(metadata)) {
    if (value === null || value === undefined) continue;

    if (
      typeof value === "string" ||
      typeof value === "number" ||
      typeof value === "boolean"
    ) {
      clean[key] = value;
    } else if (
      Array.isArray(value) &&
      value.every((item) => typeof item === "string")
    ) {
      clean[key] = value;
    } else if (key === "loc" && typeof value === "object") {
      if (value.lines) {
        if (value.lines.from !== undefined)
          clean["loc_from"] = Number(value.lines.from);
        if (value.lines.to !== undefined)
          clean["loc_to"] = Number(value.lines.to);
      } else {
        clean[key] = JSON.stringify(value);
      }
    } else {
      clean[key] =
        typeof value === "object" ? JSON.stringify(value) : String(value);
    }
  }

  return clean;
}

const EMBED_MAX_ATTEMPTS = 4;
const EMBED_BASE_DELAY_MS = 3000;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** True when the embedding call effectively produced nothing usable (incl. all-empty vectors). */
function isEmptyEmbeddingResult(vectors) {
  return (
    !vectors ||
    vectors.length === 0 ||
    vectors.every((vector) => !vector || vector.length === 0)
  );
}

/**
 * Embeds a batch with retry + exponential backoff. Handles two failure shapes seen from the
 * Gemini embedding API under rate limiting: a thrown error, and (more insidiously) a
 * successful-looking response where every vector comes back empty.
 */
async function embedDocumentsWithRetry(texts, batchNum) {
  let lastVectors = null;

  for (let attempt = 1; attempt <= EMBED_MAX_ATTEMPTS; attempt++) {
    let vectors;
    try {
      vectors = await embeddings.embedDocuments(texts);
    } catch (error) {
      if (attempt === EMBED_MAX_ATTEMPTS) throw error;
      const delay = EMBED_BASE_DELAY_MS * 2 ** (attempt - 1);
      console.warn(
        `[saveChunks] Embedding threw on batch ${batchNum}, attempt ${attempt}/${EMBED_MAX_ATTEMPTS} (${error.message}). Retrying in ${delay}ms...`,
      );
      await sleep(delay);
      continue;
    }

    if (!isEmptyEmbeddingResult(vectors)) return vectors;

    lastVectors = vectors;
    if (attempt < EMBED_MAX_ATTEMPTS) {
      const delay = EMBED_BASE_DELAY_MS * 2 ** (attempt - 1);
      console.warn(
        `[saveChunks] Batch ${batchNum} came back empty (likely rate-limited), attempt ${attempt}/${EMBED_MAX_ATTEMPTS}. Retrying in ${delay}ms...`,
      );
      await sleep(delay);
    }
  }

  return lastVectors;
}

/**
 * Saves document chunks into Pinecone for a given repository namespace in batches.
 *
 * @param {string} repoKey - E.g. "owner/repo"
 * @param {Array<Document|Object>} documents
 * @param {string} [indexName]
 * @returns {Promise<boolean>}
 */
export async function saveChunks(
  repoKey,
  documents,
  indexName = process.env.PINECONE_INDEX || "git-wiki",
  onBatch,
) {
  if (!documents || documents.length === 0) {
    console.warn(
      `[saveChunks] No documents provided for "${repoKey}". Skipping.`,
    );
    return false;
  }

  // Convert plain objects to Document instances
  const formattedDocs = documents.map((doc) => {
    if (doc instanceof Document) return doc;
    return new Document({
      pageContent: doc.pageContent || "",
      metadata: doc.metadata || {},
    });
  });

  const validDocs = formattedDocs.filter(
    (doc) => doc.pageContent && doc.pageContent.trim().length > 0,
  );
  if (validDocs.length === 0) {
    console.warn(
      `[saveChunks] All documents have empty content for "${repoKey}". Skipping.`,
    );
    return false;
  }

  console.log(
    `[saveChunks] Embedding & upserting ${validDocs.length} chunks into Pinecone namespace "${repoKey}" (Target Dim: ${TARGET_DIMENSION})...`,
  );

  // Validate embedding API connectivity
  try {
    const testVec = await embeddings.embedQuery("test");
    if (!testVec || testVec.length === 0) {
      throw new Error("Embedding API returned empty vector.");
    }
    console.log(
      `[saveChunks] Embedding test passed. Raw dimension: ${testVec.length} -> Target dimension: ${TARGET_DIMENSION}`,
    );
  } catch (error) {
    console.error(`[saveChunks] Embedding test failed:`, error.message);
    throw new Error(`Embedding API error: ${error.message}`);
  }

  const index = getPineconeIndex(indexName);
  const BATCH_SIZE = 30;
  const totalBatches = Math.ceil(validDocs.length / BATCH_SIZE);

  for (let i = 0; i < validDocs.length; i += BATCH_SIZE) {
    const batch = validDocs.slice(i, i + BATCH_SIZE);
    const batchNum = Math.floor(i / BATCH_SIZE) + 1;

    console.log(
      `[saveChunks] Processing batch ${batchNum}/${totalBatches} (${batch.length} chunks)...`,
    );

    const texts = batch.map((doc) => doc.pageContent);
    let vectors;
    try {
      vectors = await embedDocumentsWithRetry(texts, batchNum);
    } catch (error) {
      console.error(
        `[saveChunks] Embedding failed on batch ${batchNum}:`,
        error.message,
      );
      throw error;
    }

    if (isEmptyEmbeddingResult(vectors)) {
      console.warn(
        `[saveChunks] No vectors returned for batch ${batchNum}. Skipping.`,
      );
      continue;
    }

    const count = Math.min(vectors.length, batch.length);
    const records = [];
    for (let j = 0; j < count; j++) {
      if (!vectors[j] || vectors[j].length === 0) continue;
      const adjustedValues = adjustDimension(vectors[j], TARGET_DIMENSION);
      const cleanMetadata = sanitizeMetadata({
        ...batch[j].metadata,
        text: batch[j].pageContent,
      });

      // Deterministic id (repo + chunk position) so a full-step retry upserts over the
      // same vectors instead of appending duplicates alongside a partial prior attempt.
      records.push({
        id: `${repoKey.replace(/[^a-zA-Z0-9_-]/g, "_")}-${i + j}`,
        values: adjustedValues,
        metadata: cleanMetadata,
      });
    }

    if (records.length === 0) {
      console.warn(
        `[saveChunks] No valid records built for batch ${batchNum}. Skipping.`,
      );
      continue;
    }

    try {
      const ns = index.namespace(repoKey);
      await ns.upsert({ records });
    } catch (error) {
      console.error(
        `[saveChunks] Pinecone upsert failed on batch ${batchNum}:`,
        error.message,
      );
      throw error;
    }

    onBatch?.({
      batch: batchNum,
      totalBatches,
      embedded: Math.min(i + BATCH_SIZE, validDocs.length),
      total: validDocs.length,
    });
  }

  console.log(
    `[saveChunks] Done. Indexed ${validDocs.length} chunks into Pinecone namespace "${repoKey}".`,
  );
  return true;
}

/**
 * Indexes repository files into Pinecone vector store.
 */
export async function indexRepoDocs(files, repoIdentifier, options = {}) {
  const {
    chunkSize = 1000,
    chunkOverlap = 200,
    indexName = process.env.PINECONE_INDEX || "git-wiki",
  } = options;

  if (!files || files.length === 0) {
    console.warn(
      `[indexRepoDocs] No files provided for repo "${repoIdentifier}". Skipping.`,
    );
    return false;
  }

  const documents = files.map(
    (file) =>
      new Document({
        pageContent: `File: ${file.path}\n\n${file.content}`,
        metadata: {
          path: file.path,
          sha: file.sha || "",
          repo: repoIdentifier,
        },
      }),
  );

  const textSplitter = new RecursiveCharacterTextSplitter({
    chunkSize,
    chunkOverlap,
  });

  const splitDocs = await textSplitter.splitDocuments(documents);
  return await saveChunks(repoIdentifier, splitDocs, indexName);
}

/**
 * Performs a similarity search in Pinecone for a given repository.
 */
export async function queryVectorStore(query, repoIdentifier, options = {}) {
  const { k = 5, indexName = process.env.PINECONE_INDEX || "git-wiki" } =
    options;

  const rawVector = await embeddings.embedQuery(query);
  const vector = adjustDimension(rawVector, TARGET_DIMENSION);

  const index = getPineconeIndex(indexName);
  const ns = index.namespace(repoIdentifier);

  const response = await ns.query({
    vector,
    topK: k,
    includeMetadata: true,
  });

  return (response.matches || []).map(
    (match) =>
      new Document({
        pageContent: match.metadata?.text || "",
        metadata: { ...(match.metadata || {}), score: match.score ?? 0 },
      }),
  );
}

/**
 * Retrieves the PineconeStore instance for existing vector index.
 */
export async function getVectorStore(
  repoIdentifier,
  indexName = process.env.PINECONE_INDEX || "git-wiki",
) {
  const index = getPineconeIndex(indexName);
  return await PineconeStore.fromExistingIndex(embeddings, {
    pineconeIndex: index,
    namespace: repoIdentifier,
  });
}
