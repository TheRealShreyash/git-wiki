import { inngest } from "./client.js";
import { helloWorld } from "./functions/helloWorld.js";
import { indexRepo } from "./functions/indexRepo.js";
import { askQuestionFunction } from "./functions/askQuestion.js";

export { inngest };
export const functions = [helloWorld, indexRepo, askQuestionFunction];
