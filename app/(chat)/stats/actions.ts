"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { appAuth } from "@/lib/auth/server";
import {
  borrowCreditsFromTomorrowByUserId,
  getOrCreateUser,
} from "@/lib/db/queries";

const GUEST_ID_COOKIE_NAME = "guest_user_id";

export async function borrowFromTomorrow(formData: FormData) {
  const amount = Number(formData.get("amount") ?? 0);
  const normalizedAmount = Number.isFinite(amount) ? Math.max(1, Math.floor(amount)) : 1;

  const { userId: clerkUserId } = await appAuth();
  const cookieStore = await cookies();
  const guestId = cookieStore.get(GUEST_ID_COOKIE_NAME)?.value;

  const currentUserId = clerkUserId ?? guestId;
  if (!currentUserId) {
    throw new Error("Unauthorized");
  }

  const userType = clerkUserId ? "regular" : "guest";

  await getOrCreateUser(currentUserId, undefined, { userType });
  await borrowCreditsFromTomorrowByUserId({
    id: currentUserId,
    userType,
    amount: normalizedAmount,
  });

  revalidatePath("/stats");
  revalidatePath("/");
}
