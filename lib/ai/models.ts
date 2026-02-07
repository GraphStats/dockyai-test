// Curated list of top models from Hugging Face
export const DEFAULT_CHAT_MODEL = "meta-llama/Llama-3.1-8B-Instruct";

export type ChatModel = {
  id: string;
  name: string;
  provider: string;
  description: string;
};

export const chatModels: ChatModel[] = [
  {
    id: "openai/gpt-oss-120b",
    name: "GPT-4",
    provider: "OpenAI",
    description: "For powerful reasoning, agentic tasks, and versatile developer use cases."
  },
  {
    id: "google/gemma-3-27b-it",
    name: "Gemma 3",
    provider: "Google",
    description: "Gemma is a family of lightweight, state-of-the-art open models from Google"
  },
  {
    id: "Qwen/Qwen3-Next-80B-A3B-Instruct",
    name: "Qwen 3 Next",
    provider: "Alibaba",
    description: "The best model of Qwen!"
  },
  {
    id: "Qwen/Qwen3-Coder-30B-A3B-Instruct",
    name: "Qwen 3 Coder",
    provider: "Alibaba",
    description: "Optimized for coding tasks",
  },
  {
    id: "Qwen/Qwen2.5-VL-72B-Instruct",
    name: "Qwen 2.5",
    provider: "Alibaba",
    description: "Vision-language 72B model with image understanding.",
  },
  {
    id: "zai-org/GLM-4.7",
    name: "GLM 4.7",
    provider: "zAI",
    description: "Enhanced version of GLM-4.7",
  },
  {
    id: "zai-org/GLM-4.7-Flash",
    name: "GLM 4.7 Flash",
    provider: "zAI",
    description: "A powerful multilingual model",
  },
  {
    id: "moonshotai/Kimi-K2-Instruct",
    name: "Kimi K2",
    provider: "Moonshot",
    description: "Kimi K2 from Moonshot AI (Hugging Face responses endpoint).",
  },
];

/**
 * Some Hugging Face hosted models still do not reliably support tool-calling
 */
const toolSupportedModelIds = new Set<string>([
  "meta-llama/Llama-3.1-8B-Instruct",
  "meta-llama/Llama-3.1-70B-Instruct",
  "meta-llama/Llama-3.3-70B-Instruct",
  "Qwen/Qwen2.5-VL-72B-Instruct",
  "google/gemma-3-27b-it",
  "google/gemma-2-9b-it",
]);

export const supportsTools = (modelId: string) =>
  toolSupportedModelIds.has(modelId);

// Vision-capable models (accept image parts). Fill as you verify them.
export const visionSupportedModelIds = new Set<string>([
  "Qwen/Qwen2.5-VL-72B-Instruct",
]);

// Group models by provider for UI
export const modelsByProvider = chatModels.reduce(
  (acc, model) => {
    if (!acc[model.provider]) {
      acc[model.provider] = [];
    }
    acc[model.provider].push(model);
    return acc;
  },
  {} as Record<string, ChatModel[]>
);
