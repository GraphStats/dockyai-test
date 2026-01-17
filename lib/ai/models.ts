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
    description: "Meta's most advanced 8B parameter model",
  },
  // Mistral
  {
    id: "mistralai/Mistral-7B-Instruct-v0.3",
    name: "Mistral 7B v0.3",
    provider: "mistral",
    description: "Mistral's popular small-footprint model",
  },
  // Google
  {
    id: "google/gemma-2-9b-it",
    name: "Gemma 2 9B",
    provider: "google",
    description: "Google's high-performance 9B model",
  },
  // Qwen (Alibaba)
  {
    id: "Qwen/Qwen2.5-7B-Instruct",
    name: "Qwen 2.5 7B",
    provider: "alibaba",
    description: "Alibaba's latest 7B performance model",
  },
  // NousResearch
  {
    id: "NousResearch/Hermes-3-Llama-3.1-8B",
    name: "Hermes 3 Llama 3.1",
    provider: "nous",
    description: "Highly capable model fine-tuned for reasoning",
  },
  // Microsoft
  {
    id: "microsoft/Phi-3-mini-4k-instruct",
    name: "Phi-3 Mini",
    provider: "microsoft",
    description: "Lightweight and surprisingly capable",
  },
  // Community
  {
    id: "HuggingFaceH4/zephyr-7b-beta",
    name: "Zephyr 7B Beta",
    provider: "huggingface",
    description: "Popular model for chat and instruction following",
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
