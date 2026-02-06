"use server";

import { Groq } from "groq-sdk";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { MODELS } from "@/lib/models";

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
const genAI = new GoogleGenerativeAI(process.env.GOOGLE_AI_API_KEY || "");

export async function chatWithModel(modelId: string, messages: any[]) {

    try {
        console.log(`[DockyAI] Routing Request -> Model: ${modelId}`);

        // Google Gemini handling
        if (modelId.startsWith('gemini')) {
            const model = genAI.getGenerativeModel({ model: modelId });
            const prompt = messages[messages.length - 1].content;
            const result = await model.generateContent(prompt);
            const response = await result.response;
            return { content: response.text() };
        }

        // OpenRouter & Hugging Face handling
        const modelInfo = MODELS.find(m => m.id === modelId);
        if (modelInfo?.provider === 'openrouter' || modelInfo?.provider === 'huggingface') {
            let url = "";
            let apiKey = "";
            let headers: Record<string, string> = {
                "Content-Type": "application/json",
            };

            if (modelInfo.provider === 'openrouter') {
                url = "https://openrouter.ai/api/v1/chat/completions";
                apiKey = process.env.OPENROUTER_API_KEY || "";
                headers["Authorization"] = `Bearer ${apiKey}`;
            } else {
                url = `https://api-inference.huggingface.co/models/${modelId}/v1/chat/completions`;
                apiKey = process.env.HUGGINGFACE_API_KEY || "";
                headers["Authorization"] = `Bearer ${apiKey}`;
            }

            const res = await fetch(url, {
                method: "POST",
                headers: headers,
                body: JSON.stringify({
                    model: modelId,
                    messages: messages.map((m: any) => ({ role: m.role, content: m.content || "" })),
                }),

            });

            if (!res.ok) {
                const error = await res.json();
                throw new Error(error.error?.message || "Erreur API");
            }

            const data = await res.json();
            return { content: data.choices[0].message.content };
        }

        // Default to Groq for all other free models (Llama, GPT OSS, Qwen, DeepSeek, etc.)
        const response = await groq.chat.completions.create({
            model: modelId,
            messages: messages.map(m => ({
                role: m.role,
                content: m.content || ""
            })),
        });

        return { content: response.choices[0].message.content };


    } catch (error: any) {
        console.error("[DockyAI] Provider Error:", error.message);

        // Return the exact error for debugging (user wants to see if it works or not)
        return { error: `Erreur ${modelId} : ${error.message}` };
    }
}
