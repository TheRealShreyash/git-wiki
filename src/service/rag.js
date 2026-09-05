import { ChatGoogleGenerativeAI } from "@langchain/google-genai";
import { ChatPromptTemplate } from "@langchain/core/prompts";
import { StringOutputParser } from "@langchain/core/output_parsers";
import { queryVectorStore } from "./vectorStore.js";
import { inngest } from "../inngest/client.js";
import dotenv from "dotenv";

dotenv.config();

export const googleApiKey =
  process.env.GEMINI_KEY ||
  process.env.GEMINI_API_KEY ||
  process.env.GOOGLE_API_KEY ||
  "placeholder";

/**
 * Default Chat Model configuration.
 * Uses gemini-1.5-flash for low latency and high quality reasoning.
 */
export const chatModel = new ChatGoogleGenerativeAI({
  model: process.env.GEMINI_CHAT_MODEL || "gemini-2.5-flash",
  apiKey: googleApiKey,
  temperature: 0.2,
});

/**
 * Formats retrieved LangChain documents into a single contextual string.
 *
 * @param {Array<import("@langchain/core/documents").Document>} documents
 * @returns {string}
 */
export function formatDocuments(documents) {
  if (!documents || documents.length === 0) {
    return "No relevant code snippets or documentation found in the vector index.";
  }

  return documents
    .map((doc, idx) => {
      const path = doc.metadata?.path || "Unknown file";
      const locFrom = doc.metadata?.loc_from;
      const locTo = doc.metadata?.loc_to;
      const linesInfo =
        locFrom !== undefined && locTo !== undefined
          ? ` (lines ${locFrom}-${locTo})`
          : "";

      return `--- Snippet ${idx + 1}: ${path}${linesInfo} ---\n${doc.pageContent.trim()}`;
    })
    .join("\n\n");
}

export const RAG_SYSTEM_PROMPT = `You are an expert AI software engineer and documentation assistant analyzing the GitHub repository: "{repo}".

Your task is to answer the user's question accurately using only the retrieved code snippets and documentation provided in <context>.
Guidelines:
1. Ground your answer in the provided snippets. Cite the relevant file paths and line numbers when explaining code logic or components.
2. If the context does not contain sufficient information to fully answer the question, clearly state what is known from the context and what information is missing rather than speculating or hallucinating.
3. Provide well-structured markdown with code blocks (specifying the language) for readability.

<context>
{context}
</context>`;

export const ragPrompt = ChatPromptTemplate.fromMessages([
  ["system", RAG_SYSTEM_PROMPT],
  ["human", "{question}"],
]);

/**
 * Triggers the Inngest ask-question background function.
 *
 * @param {string} question - The user's query or question about the codebase.
 * @param {string} repoIdentifier - E.g. "owner/repo"
 * @param {Object} [options]
 * @param {number} [options.k=5] - Number of vector chunks to retrieve.
 * @param {string} [options.modelName] - Optional override for Gemini chat model.
 * @returns {Promise<{ message: string, eventId: string, question: string, repo: string }>}
 */
export async function askQuestion(question, repoIdentifier, options = {}) {
  const { k = 5, modelName } = options;

  if (!question || !question.trim()) {
    throw new Error("Question cannot be empty.");
  }
  if (!repoIdentifier || !repoIdentifier.trim()) {
    throw new Error("Repository identifier (owner/repo) is required.");
  }

  // Dispatch background event to Inngest
  const response = await inngest.send({
    name: "rag/question.request",
    data: {
      question,
      repo: repoIdentifier,
      k,
      modelName,
    },
  });

  return {
    message: "Question processing queued successfully.",
    eventId: response.ids?.[0],
    question,
    repo: repoIdentifier,
  };
}

/**
 * Directly executes question answering synchronously without Inngest event dispatch.
 * Useful for direct API calls or testing.
 *
 * @param {string} question
 * @param {string} repoIdentifier
 * @param {Object} [options]
 * @returns {Promise<{ answer: string, sources: Array<Object>, repo: string, question: string }>}
 */
export async function executeAskQuestion(question, repoIdentifier, options = {}) {
  const { k = 5, modelName } = options;

  if (!question || !question.trim()) {
    throw new Error("Question cannot be empty.");
  }
  if (!repoIdentifier || !repoIdentifier.trim()) {
    throw new Error("Repository identifier (owner/repo) is required.");
  }

  const relevantDocs = await queryVectorStore(question, repoIdentifier, { k });
  const context = formatDocuments(relevantDocs);

  const llm = modelName
    ? new ChatGoogleGenerativeAI({
        model: modelName,
        apiKey: googleApiKey,
        temperature: 0.2,
      })
    : chatModel;

  const outputParser = new StringOutputParser();
  const chain = ragPrompt.pipe(llm).pipe(outputParser);

  const answer = await chain.invoke({
    repo: repoIdentifier,
    context,
    question,
  });

  const sources = relevantDocs.map((doc) => ({
    path: doc.metadata?.path || "Unknown",
    loc_from: doc.metadata?.loc_from,
    loc_to: doc.metadata?.loc_to,
    repo: doc.metadata?.repo || repoIdentifier,
  }));

  return {
    question,
    repo: repoIdentifier,
    answer,
    sources,
  };
}

/**
 * Streams the answer for a given question and repository.
 *
 * @param {string} question
 * @param {string} repoIdentifier
 * @param {Object} [options]
 * @returns {Promise<{ stream: AsyncIterable<string>, sources: Array<Object> }>}
 */
export async function streamQuestion(question, repoIdentifier, options = {}) {
  const { k = 5, modelName } = options;

  if (!question || !question.trim()) {
    throw new Error("Question cannot be empty.");
  }
  if (!repoIdentifier || !repoIdentifier.trim()) {
    throw new Error("Repository identifier (owner/repo) is required.");
  }

  const relevantDocs = await queryVectorStore(question, repoIdentifier, { k });
  const context = formatDocuments(relevantDocs);

  const llm = modelName
    ? new ChatGoogleGenerativeAI({
        model: modelName,
        apiKey: googleApiKey,
        temperature: 0.2,
      })
    : chatModel;

  const outputParser = new StringOutputParser();
  const chain = ragPrompt.pipe(llm).pipe(outputParser);

  const stream = await chain.stream({
    repo: repoIdentifier,
    context,
    question,
  });

  const sources = relevantDocs.map((doc) => ({
    path: doc.metadata?.path || "Unknown",
    loc_from: doc.metadata?.loc_from,
    loc_to: doc.metadata?.loc_to,
    repo: doc.metadata?.repo || repoIdentifier,
  }));

  return {
    stream,
    sources,
  };
}
