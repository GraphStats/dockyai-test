// Curated list of top models from Hugging Face
export const DEFAULT_CHAT_MODEL = "meta-llama/Llama-3.1-8B-Instruct";
export const AUTO_MODEL_ID = "auto";

export type ChatModel = {
  id: string;
  name: string;
  provider: string;
  description: string;
  creditCost: number;
};

export const chatModels: ChatModel[] = [
  {
    id: "openai/gpt-oss-120b",
    name: "GPT-4",
    provider: "OpenAI",
    description:
      "For powerful reasoning, agentic tasks, and versatile developer use cases.",
    creditCost: 10,
  },
  {
    id: "google/gemma-3-27b-it",
    name: "Gemma 3",
    provider: "Google",
    description:
      "Gemma is a family of lightweight, state-of-the-art open models from Google",
    creditCost: 3,
  },
  {
    id: "Qwen/Qwen3-8B:fastest",
    name: "Qwen 3",
    provider: "Alibaba",
    description: "Fastest variant of Qwen 3 8B.",
    creditCost: 2,
  },
  {
    id: "Qwen/Qwen3-Next-80B-A3B-Instruct",
    name: "Qwen 3 Next",
    provider: "Alibaba",
    description: "The best model of Qwen!",
    creditCost: 4,
  },
  {
    id: "Qwen/Qwen3-Coder-30B-A3B-Instruct",
    name: "Qwen 3 Coder",
    provider: "Alibaba",
    description: "Optimized for coding tasks",
    creditCost: 3,
  },
  {
    id: "zai-org/GLM-5:fastest",
    name: "GLM 5",
    provider: "zAI",
    description: "Fastest variant of GLM 5.",
    creditCost: 4,
  },
  {
    id: "zai-org/GLM-4.7",
    name: "GLM 4.7",
    provider: "zAI",
    description: "Enhanced version of GLM-4.7",
    creditCost: 4,
  },
  {
    id: "zai-org/GLM-4.7-Flash",
    name: "GLM 4.7 Flash",
    provider: "zAI",
    description: "A powerful multilingual model",
    creditCost: 2,
  },
  {
    id: "zai-org/GLM-4.6V-Flash:fastest",
    name: "GLM 4.6 Flash",
    provider: "zAI",
    description: "Fastest variant of GLM 4.6V Flash.",
    creditCost: 1,
  },
  {
    id: "moonshotai/Kimi-K2.5:fastest",
    name: "Kimi K2.5",
    provider: "Moonshot",
    description: "Fastest variant of Kimi K2.5.",
    creditCost: 4,
  },
  {
    id: "moonshotai/Kimi-K2-Instruct",
    name: "Kimi K2",
    provider: "Moonshot",
    description: "Kimi K2 from Moonshot AI.",
    creditCost: 3,
  },
  {
    id: "MiniMaxAI/MiniMax-M2.5:fastest",
    name: "MiniMax M2.5",
    provider: "MiniMax",
    description: "Fastest variant of MiniMax M2.5.",
    creditCost: 2,
  },
  {
    id: "meta-llama/Llama-4-Scout-17B-16E-Instruct:fastest",
    name: "Llama 4",
    provider: "Meta",
    description: "Fastest variant of Llama 4 Scout 17B 16E Instruct.",
    creditCost: 2,
  },
  {
    id: "meta-llama/Llama-3.1-8B-Instruct:fastest",
    name: "Llama 3.1",
    provider: "Meta",
    description: "Fastest variant of Llama 3.1 8B Instruct.",
    creditCost: 1,
  },
  {
    id: "meta-llama/Meta-Llama-3-8B-Instruct",
    name: "Llama 3",
    provider: "Meta",
    description:
      "The Meta Llama 3 collection of multilingual large language models",
    creditCost: 1,
  },
];

const modelCreditFallbackById: Record<string, number> = {
  "meta-llama/Llama-3.1-8B-Instruct": 1,
  "meta-llama/Llama-3.1-70B-Instruct": 6,
  "meta-llama/Llama-3.2-3B-Instruct": 1,
  "Qwen/Qwen2.5-72B-Instruct": 4,
  "Qwen/Qwen2.5-7B-Instruct": 1,
  "Qwen/Qwen2.5-Coder-32B-Instruct": 3,
  "Qwen/Qwen2.5-VL-72B-Instruct": 4,
  "moonshotai/Kimi-K2.5": 4,
};

export const getModelCreditCost = (modelId: string): number => {
  if (modelId === AUTO_MODEL_ID) {
    return 0;
  }

  const selectedModel = chatModels.find((model) => model.id === modelId);
  if (selectedModel) {
    return selectedModel.creditCost;
  }

  return modelCreditFallbackById[modelId] ?? 2;
};

export const getEffectiveModelCreditCost = ({
  modelId,
  multiplier,
}: {
  modelId: string;
  multiplier: number;
}) => {
  const baseCost = getModelCreditCost(modelId);
  const safeMultiplier = Number.isFinite(multiplier) && multiplier > 0 ? multiplier : 1;
  return Math.max(1, Math.ceil(baseCost * safeMultiplier));
};

/**
 * Some Hugging Face hosted models still do not reliably support tool-calling
 */
const toolSupportedModelIds = new Set<string>([
  "meta-llama/Llama-3.1-8B-Instruct",
  "meta-llama/Llama-3.1-70B-Instruct",
  "meta-llama/Llama-3.3-70B-Instruct",
  "Qwen/Qwen2.5-VL-72B-Instruct",
  "google/gemma-3-27b-it",
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
