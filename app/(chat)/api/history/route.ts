import type { NextRequest } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { deleteAllChatsByUserId, getChatsByUserId } from "@/lib/db/queries";
import { ChatSDKError } from "@/lib/errors";
import { cookies } from "next/headers"; // Import cookies

const GUEST_ID_COOKIE_NAME = "guest_user_id"; // Define guest cookie name, matching chat route

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;

  const limit = Number.parseInt(searchParams.get("limit") || "10", 10);
  const startingAfter = searchParams.get("starting_after");
  const endingBefore = searchParams.get("ending_before");

  if (startingAfter && endingBefore) {
    return new ChatSDKError(
      "bad_request:api",
      "Only one of starting_after or ending_before can be provided."
    ).toResponse();
  }

  const { userId: clerkUserId } = await auth(); // Rename to clerkUserId
  let currentUserId: string | null = null;

  if (clerkUserId) {
    currentUserId = clerkUserId;
  } else {
    const cookieStore = cookies();
    const guestIdFromCookie = cookieStore.get(GUEST_ID_COOKIE_NAME);
    if (guestIdFromCookie) {
      currentUserId = guestIdFromCookie.value;
    }
  }

  if (!currentUserId) { // Check if we have any user ID
    return new ChatSDKError("unauthorized:chat").toResponse();
  }

  const chats = await getChatsByUserId({
    id: currentUserId, // Use currentUserId
    limit,
    startingAfter,
    endingBefore,
  });

  return Response.json(chats);
}

export async function DELETE() {
  const { userId } = await auth();

  if (!userId) {
    return new ChatSDKError("unauthorized:chat").toResponse();
  }

  const result = await deleteAllChatsByUserId({ userId });

  return Response.json(result, { status: 200 });
}
