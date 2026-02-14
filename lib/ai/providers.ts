import { createHuggingFace } from "@ai-sdk/huggingface";
import {
  customProvider,
  extractReasoningMiddleware,
  wrapLanguageModel,
} from "ai";
import { isTestEnvironment } from "../constants";

const configuredKeys = [
  process.env.HUGGING_FACE_API_KEY?.trim(),
  ...(process.env.HUGGING_FACE_API_KEYS?.split(",").map((k) => k.trim()) ?? []),
].filter((k): k is string => Boolean(k));

const uniqueKeys = Array.from(new Set(configuredKeys));

if (uniqueKeys.length === 0) {
  console.warn("No Hugging Face API keys configured (HUGGING_FACE_API_KEY / HUGGING_FACE_API_KEYS)");
}

const huggingfaceClients = uniqueKeys.map((apiKey) =>
  createHuggingFace({ apiKey })
);

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

function buildLanguageModel(clientIndex: number, modelId: string) {
  const client = huggingfaceClients[clientIndex];
  if (isTestEnvironment && myProvider) {
    return myProvider.languageModel(modelId);
  }

  if (!client) {
    throw new Error("No Hugging Face client available");
  }

  const isReasoningModel =
    modelId.includes("reasoning") || modelId.endsWith("-thinking");

  if (isReasoningModel) {
    const baseModelId = modelId.replace(THINKING_SUFFIX_REGEX, "");

    return wrapLanguageModel({
      model: client.languageModel(baseModelId),
      middleware: extractReasoningMiddleware({ tagName: "thinking" }),
    });
  }

  return client.languageModel(modelId);
}

export function getLanguageModel(modelId: string) {
  return buildLanguageModel(0, modelId);
}

export function getLanguageModelFallbackChain(modelId: string) {
  if (isTestEnvironment && myProvider) {
    return [myProvider.languageModel(modelId)];
  }

  if (huggingfaceClients.length === 0) {
    return [];
  }

  return huggingfaceClients.map((_, index) => buildLanguageModel(index, modelId));
}

export function hasHuggingFaceApiKeyConfigured() {
  return isTestEnvironment || huggingfaceClients.length > 0;
}

export function getTitleModel() {
  if (isTestEnvironment && myProvider) {
    return myProvider.languageModel("title-model");
  }
  return buildLanguageModel(0, "meta-llama/Llama-3.1-8B-Instruct");
}

export function getArtifactModel() {
  if (isTestEnvironment && myProvider) {
    return myProvider.languageModel("artifact-model");
  }
  return buildLanguageModel(0, "mistralai/Mistral-7B-Instruct-v0.3");
}

