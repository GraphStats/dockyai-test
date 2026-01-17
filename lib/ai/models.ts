// Curated list of top models from Hugging Face
export const DEFAULT_CHAT_MODEL = "meta-llama/Llama-3.1-8B-Instruct";

export type ChatModel = {
  id: string;
  name: string;
  provider: string;
  description: string;
};

export const chatModels: ChatModel[] = [
  // Meta
  {
    id: "meta-llama/Llama-3.1-8B-Instruct",
    name: "Llama 3.1 8B",
    provider: "meta",
    description: "Meta's efficient 8B parameter model",
  },
  {
    id: "meta-llama/Llama-3.1-70B-Instruct",
    name: "Llama 3.1 70B",
    provider: "meta",
    description: "Highly capable model for complex tasks",
  },
  // Mistral
  {
    id: "mistralai/Mistral-7B-Instruct-v0.3",
    name: "Mistral 7B v0.3",
    provider: "mistral",
    description: "Mistral's popular small-footprint model",
  },
  {
    id: "mistralai/Mixtral-8x7B-Instruct-v0.1",
    name: "Mixtral 8x7B",
    provider: "mistral",
    description: "High-quality sparse mixture-of-experts model",
  },
  // Google
  {
    id: "google/gemma-2-9b-it",
    name: "Gemma 2 9B",
    provider: "google",
    description: "Google's high-performance open model",
  },
  {
    id: "google/gemma-2-27b-it",
    name: "Gemma 2 27B",
    provider: "google",
    description: "Powerful 27B parameter model from Google",
  },
  // Microsoft
  {
    id: "microsoft/Phi-3-mini-4k-instruct",
    name: "Phi-3 Mini",
    provider: "microsoft",
    description: "Lightweight and surprisingly capable",
  },
  // Qwen
  {
    id: "Qwen/Qwen2.5-72B-Instruct",
    name: "Qwen 2.5 72B",
    provider: "alibaba",
    description: "Alibaba's most powerful open model",
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
