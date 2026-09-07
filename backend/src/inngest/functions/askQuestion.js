import { inngest } from "../client.js";
import { queryVectorStore } from "../../service/vectorStore.js";
import {
  formatDocuments,
  ragPrompt,
  chatModel,
  googleApiKey,
} from "../../service/rag.js";
import { ChatGoogleGenerativeAI } from "@langchain/google-genai";
import { StringOutputParser } from "@langchain/core/output_parsers";

export const askQuestionFunction = inngest.createFunction(
  { id: "ask-question", triggers: [{ event: "rag/question.request" }] },
  async ({ event, step }) => {
    const { question, repo, k = 5, modelName } = event.data;

    if (!question || !question.trim()) {
      throw new Error("Question cannot be empty.");
    }
    if (!repo || !repo.trim()) {
      throw new Error("Repository identifier is required.");
    }

    // Step 1: Retrieve relevant vector chunks from Pinecone
    const { context, sources } = await step.run(
      "retrieve-context",
      async () => {
        console.log(
          `[Inngest:askQuestion] Retrieving context for "${repo}"...`,
        );
        const relevantDocs = await queryVectorStore(question, repo, { k });
        const context = formatDocuments(relevantDocs);

        const sources = relevantDocs.map((doc) => ({
          path: doc.metadata?.path || "Unknown",
          loc_from: doc.metadata?.loc_from,
          loc_to: doc.metadata?.loc_to,
          repo: doc.metadata?.repo || repo,
        }));

        return { context, sources };
      },
    );

    // Step 2: Generate grounded answer using Gemini LLM
    const answer = await step.run("generate-answer", async () => {
      console.log(`[Inngest:askQuestion] Generating answer via Gemini LLM...`);
      const llm = modelName
        ? new ChatGoogleGenerativeAI({
            model: modelName,
            apiKey: googleApiKey,
            temperature: 0.2,
          })
        : chatModel;

      const outputParser = new StringOutputParser();
      const chain = ragPrompt.pipe(llm).pipe(outputParser);

      return await chain.invoke({
        repo,
        context,
        question,
      });
    });

    console.log(`[Inngest:askQuestion] Completed question for "${repo}".`);

    return {
      question,
      repo,
      answer,
      sources,
    };
  },
);
