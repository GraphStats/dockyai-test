// lib/ai/moderation-ai.ts
import { generateText } from "ai";
import { getLanguageModel } from "./providers";
import { moderationPrompt } from "./prompts";
import { ChatSDKError } from "@/lib/errors";

const MODERATION_MODEL_NAME = "meta-llama/Llama-3.1-8B-Instruct"; // Use a suitable Hugging Face model for moderation

export type ModerationDecision = "allow" | "review" | "block";

export async function checkMessageWithAI(messageText: string): Promise<ModerationDecision> {
  try {
    const { text: moderationResult } = await generateText({
      model: getLanguageModel(MODERATION_MODEL_NAME), // Use a dedicated model for moderation if available, or the general one.
      prompt: moderationPrompt({ message: messageText }),
      temperature: 0, // Keep temperature low for deterministic responses
    });

    const parsedResult = moderationResult.trim().toUpperCase();

    if (parsedResult === "BLOCK") return "block";
    if (parsedResult === "REVIEW") return "review";
    if (parsedResult === "ALLOW") return "allow";

    // Handle unexpected responses from the moderation AI
    console.warn("Moderation AI returned an unexpected response:", moderationResult);
    // Default to allow to minimize false positives but still log for follow-up.
    return "allow";
  } catch (error) {
    console.error("Error during AI moderation check:", error);
    // If the moderation AI itself fails, what should we do?
    // For now, let's throw an error indicating a moderation service issue,
    // which the main API route can catch and handle.
    throw new ChatSDKError("offline:chat", "Failed to perform AI moderation check");
  }
}
