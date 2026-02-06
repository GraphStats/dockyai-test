import { NextRequest } from "next/server";
import { Groq } from "groq-sdk";
import { MODELS } from "@/lib/models";

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

export async function POST(req: NextRequest) {
    try {
        const { modelId, messages } = await req.json();

        if (!modelId || !messages || !Array.isArray(messages)) {
            return new Response(JSON.stringify({ error: "Requête malformée : modelId ou messages manquants." }), { status: 400 });
        }

        const model = MODELS.find(m => m.id === modelId);
        if (!model) {
            return new Response(JSON.stringify({ error: `Modèle ${modelId} non trouvé.` }), { status: 400 });
        }

        if (model.provider === 'groq') {
            const stream = await groq.chat.completions.create({
                model: modelId,
                messages: messages.map((m: any) => ({
                    role: m.role === 'user' || m.role === 'assistant' ? m.role : 'user',
                    content: m.content || ""
                })),
                stream: true,
            });

            const encoder = new TextEncoder();
            const readableStream = new ReadableStream({
                async start(controller) {
                    try {
                        for await (const chunk of stream) {
                            const content = chunk.choices[0]?.delta?.content || "";
                            if (content) {
                                controller.enqueue(encoder.encode(content));
                            }
                        }
                    } catch (streamErr: any) {
                        console.error("[Groq Stream Error]:", streamErr);
                    } finally {
                        controller.close();
                    }
                },
            });

            return new Response(readableStream, {
                headers: {
                    "Content-Type": "text/event-stream",
                    "Cache-Control": "no-cache",
                    "Connection": "keep-alive",
                },
            });
        }

        if (model.provider === 'openrouter' || model.provider === 'huggingface') {
            let url = "";
            let apiKey = "";
            let headers: Record<string, string> = {
                "Content-Type": "application/json",
            };

            if (model.provider === 'openrouter') {
                url = "https://openrouter.ai/api/v1/chat/completions";
                apiKey = process.env.OPENROUTER_API_KEY || "";
                headers["Authorization"] = `Bearer ${apiKey}`;
                headers["HTTP-Referer"] = "https://docky-ai.vercel.app"; // Optional, for OpenRouter analytics
                headers["X-Title"] = "DockyAI";
            } else {
                url = `https://api-inference.huggingface.co/models/${modelId}/v1/chat/completions`;
                apiKey = process.env.HUGGINGFACE_API_KEY || "";
                headers["Authorization"] = `Bearer ${apiKey}`;
            }

            const response = await fetch(url, {
                method: "POST",
                headers: headers,
                body: JSON.stringify({
                    model: modelId,
                    messages: messages.map((m: any) => ({
                        role: m.role,
                        content: m.content || ""
                    })),
                    stream: true,
                }),
            });

            if (!response.ok) {
                const error = await response.json();
                return new Response(JSON.stringify({ error: error.error?.message || "Erreur API" }), { status: response.status });
            }

            // Simple proxy for streaming response
            return new Response(response.body, {
                headers: {
                    "Content-Type": "text/event-stream",
                    "Cache-Control": "no-cache",
                    "Connection": "keep-alive",
                },
            });
        }

        return new Response(JSON.stringify({ error: `Le fournisseur ${model.provider} n'est pas géré par cette route.` }), { status: 400 });

    } catch (error: any) {
        console.error("[Chat API Route Error]:", error);

        const status = error.status || 500;
        const message = error.error?.message || error.message || "Erreur interne du serveur";

        return new Response(JSON.stringify({ error: message }), { status });
    }
}

