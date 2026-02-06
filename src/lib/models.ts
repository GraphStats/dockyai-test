export type ModelTier = 'free' | 'premium';

export interface AIModel {
    id: string;
    name: string;
    provider: 'groq' | 'google' | 'puter' | 'huggingface' | 'openrouter';
    brand: string;
    tier: ModelTier;
    description: string;
    icon?: string;
    requiresPuter?: boolean;
}

export interface Message {
    role: 'user' | 'assistant';
    content: string;
    modelId?: string;
    isBlind?: boolean;
}

export interface Conversation {
    id: string;
    title: string;
    messages: Message[];
    modelId: string;
    createdAt: number;
}

export const MODELS: AIModel[] = [
    {
        id: 'llama-3.3-70b-versatile',
        name: 'Llama 3.3',
        brand: 'Meta',
        provider: 'groq',
        tier: 'free',
        description: 'Meta flagship versatile model.',
    },
    {
        id: 'llama-3.1-8b-instant',
        name: 'Llama 3.1',
        brand: 'Meta',
        provider: 'groq',
        tier: 'free',
        description: 'Ultra-fast inference.',
    },
    {
        id: 'meta-llama/llama-4-maverick-17b-128e-instruct',
        name: 'Llama 4 Maverick',
        brand: 'Meta',
        provider: 'groq',
        tier: 'free',
        description: 'Meta Llama 4 - 17B Instruct (128E).',
    },
    {
        id: 'meta-llama/llama-4-scout-17b-16e-instruct',
        name: 'Llama 4 Scout',
        brand: 'Meta',
        provider: 'groq',
        tier: 'free',
        description: 'Meta Llama 4 - 17B Instruct (16E).',
    },
    {
        id: 'openai/gpt-oss-120b',
        name: 'GPT OSS 120B',
        brand: 'OpenAI',
        provider: 'groq',
        tier: 'free',
        description: 'Large open-weights GPT series.',
    },
    {
        id: 'moonshotai/kimi-k2-instruct-0905',
        name: 'Kimi K2',
        brand: 'Moonshot',
        provider: 'groq',
        tier: 'free',
        description: 'Advanced reasoning model.',
    },
    {
        id: 'qwen/qwen3-32b',
        name: 'Qwen 3',
        brand: 'Alibaba',
        provider: 'groq',
        tier: 'free',
        description: 'Alibaba next-gen open model.',
    },
    // Hugging Face
    {
        id: 'mistralai/Mistral-7B-Instruct-v0.3',
        name: 'Mistral 7B',
        brand: 'Mistral',
        provider: 'huggingface',
        tier: 'free',
        description: 'Mistral AI lightweight high-perf model.',
    },
    {
        id: 'google/gemma-2-9b-it',
        name: 'Gemma 2 9B',
        brand: 'Google',
        provider: 'huggingface',
        tier: 'free',
        description: 'Google next-gen lightweight model.',
    },
    // OpenRouter
    {
        id: 'google/gemini-2.0-flash-exp:free',
        name: 'Gemini 2.0 Flash',
        brand: 'Google',
        provider: 'openrouter',
        tier: 'free',
        description: 'OpenRouter free tier Gemini.',
    },
    {
        id: 'deepseek/deepseek-r1:free',
        name: 'DeepSeek R1',
        brand: 'DeepSeek',
        provider: 'openrouter',
        tier: 'free',
        description: 'OpenRouter free tier DeepSeek.',
    },
    {
        id: 'openai/gpt-4o-mini',
        name: 'GPT-4o Mini',
        brand: 'OpenAI',
        provider: 'openrouter',
        tier: 'free',
        description: 'Fast and efficient OpenAI model.',
    },
];



