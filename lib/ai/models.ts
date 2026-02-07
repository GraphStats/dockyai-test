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
