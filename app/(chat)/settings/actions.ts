"use server";

import { appAuth } from "@/lib/auth/server";
import { getOrCreateUser, updateUserById } from "@/lib/db/queries";
import { revalidatePath } from "next/cache";

export async function updateUserSettings(formData: FormData) {
  const { userId } = await appAuth();
  if (!userId) {
    throw new Error("Unauthorized");
  }

  try {
    const customInstructions = formData.get("customInstructions") as string;
    const useLocation = formData.get("useLocation") === "on";
    const referenceChatHistory = formData.get("referenceChatHistory") === "on";
    const referenceMemories = formData.get("referenceMemories") === "on";

    await updateUserById(userId, {
      customInstructions,
      useLocation,
      referenceChatHistory,
      referenceMemories,
    });

    revalidatePath("/settings");
  } catch (error) {
    console.error("Failed to update settings:", error);
    throw error;
  }
}

export async function getUserSettings() {
  const { userId } = await appAuth();
  if (!userId) {
    return {
      customInstructions: "",
      useLocation: true,
      referenceChatHistory: true,
      referenceMemories: true,
    };
  }

  try {
    const user = await getOrCreateUser(userId);

    return {
      customInstructions: user?.customInstructions || "",
      useLocation: user?.useLocation ?? true,
      referenceChatHistory: user?.referenceChatHistory ?? true,
      referenceMemories: user?.referenceMemories ?? true,
    };
  } catch (error) {
    console.error("Failed to fetch settings from DB:", error);
    return {
      customInstructions: "",
      useLocation: true,
      referenceChatHistory: true,
      referenceMemories: true,
    };
  }
}

