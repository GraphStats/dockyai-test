import { createHuggingFace } from "@ai-sdk/huggingface";
import {
  customProvider,
  extractReasoningMiddleware,
  wrapLanguageModel,
} from "ai";
import { isTestEnvironment } from "../constants";

if (!process.env.HUGGING_FACE_API_KEY) {
  console.warn("HUGGING_FACE_API_KEY is missing from environment variables");
}

const huggingface = createHuggingFace({
  apiKey: process.env.HUGGING_FACE_API_KEY,
});

const THINKING_SUFFIX_REGEX = /-thinking$/;

export const myProvider = isTestEnvironment
  ? (() => {
      const {
        artifactModel,
        chatModel,
        reasoningModel,
        titleModel,
      } = require("./models.mock");
      return customProvider({
        languageModels: {
          "chat-model": chatModel,
          "chat-model-reasoning": reasoningModel,
          "title-model": titleModel,
          "artifact-model": artifactModel,
        },
      });
    })()
  : null;

export function getLanguageModel(modelId: string) {
  if (isTestEnvironment && myProvider) {
    return myProvider.languageModel(modelId);
  }

  const isReasoningModel =
    modelId.includes("reasoning") || modelId.endsWith("-thinking");

  if (isReasoningModel) {
    const baseModelId = modelId.replace(THINKING_SUFFIX_REGEX, "");

    return wrapLanguageModel({
      model: huggingface.languageModel(baseModelId),
      middleware: extractReasoningMiddleware({ tagName: "thinking" }),
    });
  }

  return huggingface.languageModel(modelId);
}

export function getTitleModel() {
  if (isTestEnvironment && myProvider) {
    return myProvider.languageModel("title-model");
  }
  return huggingface.languageModel("meta-llama/Llama-3.1-8B-Instruct");
}

export function getArtifactModel() {
  if (isTestEnvironment && myProvider) {
    return myProvider.languageModel("artifact-model");
  }
  return huggingface.languageModel("mistralai/Mistral-7B-Instruct-v0.3");
}
