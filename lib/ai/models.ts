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
    id: "Qwen/Qwen2.5-7B-Instruct",
    name: "Qwen 2.5 7B",
    provider: "alibaba",
    description: "Small and fast Qwen 2.5",
  },
  {
    id: "Qwen/Qwen2.5-72B-Instruct",
    name: "Qwen 2.5 72B",
    provider: "alibaba",
    description: "The most powerful Qwen 2.5",
  },
    {
    id: "Qwen/Qwen3-Coder-30B-A3B-Instruct:fireworks-ai",
    name: "Qwen 3 Coder 30B",
    provider: "alibaba",
    description: "Optimized for coding tasks",
  },
  {
    id: "zai-org/GLM-4.7-Flash:novita",
    name: "GLM-4.7-Flash",
    provider: "zai",
    description: "A powerful multilingual model",
  },
  {
    id: "zai-org/GLM-4.7:novita",
    name: "GLM-4.7",
    provider: "zai",
    description: "Enhanced version of GLM-4.7",
  },
];

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
