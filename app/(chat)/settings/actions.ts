"use server";

import { auth } from "@clerk/nextjs/server";
import { getOrCreateUser, updateUserById } from "@/lib/db/queries";
import { revalidatePath } from "next/cache";

export async function updateUserSettings(formData: FormData) {
  const { userId } = await auth();
  if (!userId) {
    throw new Error("Unauthorized");
  }

  try {
    const customInstructions = formData.get("customInstructions") as string;
    const useLocation = formData.get("useLocation") === "on";

    await updateUserById(userId, {
      customInstructions,
      useLocation,
    });

    revalidatePath("/settings");
  } catch (error) {
    console.error("Failed to update settings:", error);
    throw error;
  }
}

export async function getUserSettings() {
  const { userId } = await auth();
  if (!userId) {
    return {
      customInstructions: "",
      useLocation: true,
    };
  }

  try {
    const user = await getOrCreateUser(userId);

    return {
      customInstructions: user?.customInstructions || "",
      useLocation: user?.useLocation ?? true,
    };
  } catch (error) {
    console.error("Failed to fetch settings from DB:", error);
    return {
      customInstructions: "",
      useLocation: true,
    };
  }
}
