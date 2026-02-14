import { appAuth } from "@/lib/auth/server";
import { cookies } from "next/headers";
import { entitlementsByUserType } from "@/lib/ai/entitlements";
import {
  createGuestUser,
  getDailyCreditsStateByUserId,
  getHfPricingState,
  getOrCreateUser,
} from "@/lib/db/queries";
import { ChatSDKError } from "@/lib/errors";
import { isProductionEnvironment } from "@/lib/constants";

const GUEST_ID_COOKIE_NAME = "guest_user_id";

export async function GET() {
  const { userId: clerkUserId } = await appAuth();
  const cookieStore = await cookies();
  const userType = clerkUserId ? "regular" : "guest";
  const fallbackDailyCredits = Math.max(
    1,
    Number(entitlementsByUserType[userType].dailyCredits) || 1
  );

  try {
    let currentUserId =
      clerkUserId ?? cookieStore.get(GUEST_ID_COOKIE_NAME)?.value;

    if (!currentUserId && userType === "guest") {
      const newGuest = await createGuestUser();
      currentUserId = newGuest[0]?.id;

      if (currentUserId) {
        cookieStore.set(GUEST_ID_COOKIE_NAME, currentUserId, {
          httpOnly: true,
          secure: isProductionEnvironment,
          maxAge: 60 * 60 * 24 * 7,
          path: "/",
          sameSite: "lax",
        });
      }
    }

    if (!currentUserId) {
      return new ChatSDKError("unauthorized:chat").toResponse();
    }

    await getOrCreateUser(currentUserId, undefined, { userType });
    const creditState = await getDailyCreditsStateByUserId({
      id: currentUserId,
      userType,
    });
    const hfPricingState = await getHfPricingState();

    return Response.json({
      userType,
      remainingCredits: creditState.remainingCredits,
      dailyCredits: creditState.dailyCredits,
      resetAt: creditState.resetAt.toISOString(),
      hfPricingState,
    });
  } catch (error) {
    console.error("Failed to load credits state, using fallback:", error);
    return Response.json({
      userType,
      remainingCredits: fallbackDailyCredits,
      dailyCredits: fallbackDailyCredits,
      resetAt: new Date().toISOString(),
    });
  }
}

