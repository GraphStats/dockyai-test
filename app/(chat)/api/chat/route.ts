import { cookies } from "next/headers"; // Import cookies
import { geolocation } from "@vercel/functions";
import {
  convertToModelMessages,
  createUIMessageStream,
  createUIMessageStreamResponse,
  generateId,
  stepCountIs,
  streamText,
} from "ai";
import { after } from "next/server";
import { createResumableStreamContext } from "resumable-stream";
import { auth } from "@clerk/nextjs/server";
import { entitlementsByUserType, UserType } from "@/lib/ai/entitlements"; // Import UserType
import { type RequestHints, systemPrompt } from "@/lib/ai/prompts";
import { getLanguageModel } from "@/lib/ai/providers";
import { createDocument } from "@/lib/ai/tools/create-document";
import { getWeather } from "@/lib/ai/tools/get-weather";
import { requestSuggestions } from "@/lib/ai/tools/request-suggestions";
import { updateDocument } from "@/lib/ai/tools/update-document";
import { isProductionEnvironment } from "@/lib/constants";
import {
  createStreamId,
  deleteChatById,
  getChatById,
  getMessageCountByUserId,
  getMessagesByChatId,
  getOrCreateUser,
  getUserById,
  saveChat,
  saveMessages,
  updateChatTitleById,
  updateMessage,
  createGuestUser, // Import createGuestUser
} from "@/lib/db/queries";
import type { DBMessage } from "@/lib/db/schema";
import { ChatSDKError } from "@/lib/errors";
import type { ChatMessage } from "@/lib/types";
import { convertToUIMessages, generateUUID } from "@/lib/utils";
import { generateTitleFromUserMessage } from "../../actions";
import { checkMessageWithAI } from "@/lib/ai/moderation-ai"; // Import the AI moderation utility
import { type PostRequestBody, postRequestBodySchema } from "./schema";

export const maxDuration = 60;

const GUEST_ID_COOKIE_NAME = "guest_user_id"; // Define guest cookie name

function getStreamContext() {
  try {
    return createResumableStreamContext({ waitUntil: after });
  } catch (_) {
    return null;
  }
}

export { getStreamContext };

export async function POST(request: Request) {
  let requestBody: PostRequestBody;

  try {
    const json = await request.json();
    requestBody = postRequestBodySchema.parse(json);
  } catch (_) {
    return new ChatSDKError("bad_request:api").toResponse();
  }

  try {
    const { id, message, messages, selectedChatModel, selectedVisibilityType } =
      requestBody;

    const { userId: clerkUserId } = await auth(); // Rename to avoid conflict

    let currentUserId: string;
    let userType: UserType;
    const cookieStore = await cookies();

    if (clerkUserId) {
      currentUserId = clerkUserId;
      userType = "regular";
    } else {
      const guestIdFromCookie = cookieStore.get(GUEST_ID_COOKIE_NAME);
      let guestIdValue: string;

      if (guestIdFromCookie) {
        guestIdValue = guestIdFromCookie.value;
      } else {
        const newGuest = await createGuestUser();
        guestIdValue = newGuest[0].id;
        cookieStore.set(GUEST_ID_COOKIE_NAME, guestIdValue, {
          httpOnly: true,
          secure: isProductionEnvironment,
          maxAge: 60 * 60 * 24 * 7, // 1 week
          path: "/",
          sameSite: "lax",
        });
      }
      currentUserId = guestIdValue;
      userType = "guest";
    }

    // Ensure user exists in local DB before saving any related records (Chat, Message, etc.)
    try {
      // getOrCreateUser can handle both existing Clerk users and new guest IDs
      await getOrCreateUser(currentUserId); 
    } catch (dbError) {
      console.error("Failed to provision user in local DB:", dbError);
    }

    if (!process.env.HUGGING_FACE_API_KEY) {
      return new ChatSDKError(
        "bad_request:api",
        "HUGGING_FACE_API_KEY is missing. Please add it to your environment variables."
      ).toResponse();
    }

    const messageCount = await getMessageCountByUserId({
      id: currentUserId,
      differenceInHours: 24,
    });

    if (messageCount > entitlementsByUserType[userType].maxMessagesPerDay) {
      return new ChatSDKError("rate_limit:chat").toResponse();
    }

    const isToolApprovalFlow = Boolean(messages);

    const chat = await getChatById({ id });
    let messagesFromDb: DBMessage[] = [];
    let titlePromise: Promise<string> | null = null;

    if (chat) {
      if (chat.userId !== currentUserId) { // Use currentUserId
        return new ChatSDKError("forbidden:chat").toResponse();
      }
      if (!isToolApprovalFlow) {
        messagesFromDb = await getMessagesByChatId({ id });
      }
    } else if (message?.role === "user") {
      await saveChat({
        id,
        userId: currentUserId, // Use currentUserId
        title: "New chat",
        visibility: selectedVisibilityType,
      });
      titlePromise = generateTitleFromUserMessage({ message });
    }

    const uiMessages = isToolApprovalFlow
      ? (messages as ChatMessage[])
      : [...convertToUIMessages(messagesFromDb), message as ChatMessage];

    const { longitude, latitude, city, country } = geolocation(request);

    const requestHints: RequestHints = {
      longitude,
      latitude,
      city,
      country,
    };

    if (message?.role === "user") {
      // Extract text content from the user message parts
      const userMessageText = message.parts
        .filter((part) => part.type === "text" && part.text)
        .map((part) => (part as { text: string }).text) // Type assertion added here
        .join(" ");

      // Perform AI moderation check
      const isUnsafe = await checkMessageWithAI(userMessageText);
      if (isUnsafe) {
        console.warn(`AI moderation detected unsafe content in user message: "${userMessageText}"`);
        throw new ChatSDKError("forbidden:content");
      }

      await saveMessages({
        messages: [
          {
            chatId: id,
            id: message.id,
            role: "user",
            parts: message.parts,
            attachments: [],
            createdAt: new Date(),
            moderation: false,
          },
        ],
      });
    }

    const isReasoningModel =
      selectedChatModel.includes("reasoning") ||
      selectedChatModel.includes("thinking");

    const modelMessages = await convertToModelMessages(uiMessages);

    const stream = createUIMessageStream({
      originalMessages: isToolApprovalFlow ? uiMessages : undefined,
      execute: async ({ writer: dataStream }) => {
        console.log("Starting stream with model:", selectedChatModel);
        let userData = null;
        try {
          userData = await getOrCreateUser(currentUserId); // Use currentUserId
        } catch (dbError) {
          console.error("Failed to fetch or create user, using defaults:", dbError);
        }

        try {
          const result = await streamText({
            model: getLanguageModel(selectedChatModel),
            system: systemPrompt({ 
              selectedChatModel, 
              requestHints,
              customInstructions: userData?.customInstructions || undefined,
              useLocation: userData?.useLocation ?? true,
            }),
            messages: modelMessages,
            stopWhen: stepCountIs(5),
            experimental_activeTools: [
              "getWeather",
              "createDocument",
              "updateDocument",
              "requestSuggestions",
            ],
            providerOptions: isReasoningModel
              ? {
                  anthropic: {
                    thinking: { type: "enabled", budgetTokens: 10_000 },
                  },
                }
              : undefined,
            tools: {
              getWeather,
              createDocument: createDocument({ userId: currentUserId, dataStream }), // Use currentUserId
              updateDocument: updateDocument({ userId: currentUserId, dataStream }), // Use currentUserId
              requestSuggestions: requestSuggestions({ userId: currentUserId, dataStream }), // Use currentUserId
            },
            experimental_telemetry: {
              isEnabled: isProductionEnvironment,
              functionId: "stream-text",
            },
          });

          // AI Moderation for AI-generated messages
          const aiResponse = await result.text; // Get full AI response text
          const isAIResponseUnsafe = await checkMessageWithAI(aiResponse);

          if (isAIResponseUnsafe) {
            console.warn(`AI moderation detected unsafe content in AI response: "${aiResponse}"`);
            dataStream.write({
              type: "data-textDelta", // Corrected type for streaming text
              text: "Message modéré : le contenu a été jugé inapproprié.",
            });
            dataStream.write({ type: "metadata", data: { moderation: true } });
            // The AI message will be saved with the moderation flag in onFinish below
          } else {
            dataStream.merge(result.toUIMessageStream({ sendReasoning: true }));
          }

          if (titlePromise) {
            const title = await titlePromise;
            dataStream.write({ type: "data-chat-title", data: title });
            updateChatTitleById({ chatId: id, title });
          }
        } catch (err: any) {
          console.error("Error during stream execution:", err);
          dataStream.write({ type: "error", errorText: err.message || "Unknown error" });
        }
      },
      generateId: generateUUID,
      onFinish: async ({ messages: finishedMessages }) => {
        // AI response moderation happens inside execute, so finishedMessages will already be moderated if needed.
        if (isToolApprovalFlow) {
          for (const finishedMsg of finishedMessages) {
            const existingMsg = uiMessages.find((m) => m.id === finishedMsg.id);
            if (existingMsg) {
              await updateMessage({
                id: finishedMsg.id,
                parts: finishedMsg.parts,
              });
            } else {
              await saveMessages({
                messages: [
                  {
                                      id: finishedMsg.id,
                                      role: finishedMsg.role,
                                      parts: finishedMsg.parts,
                                      createdAt: new Date(),
                                      attachments: [],
                                      chatId: id,
                                      moderation: finishedMsg.experimental_metadata?.moderation || false, // Set moderation flag
                                    },                ],
              });
            }
          }
        } else if (finishedMessages.length > 0) {
          // For AI generated messages, if they were moderated, their parts and metadata would be updated in 'execute'
          await saveMessages({
            messages: finishedMessages.map((currentMessage) => ({
              id: currentMessage.id,
              role: currentMessage.role,
              parts: currentMessage.parts,
              createdAt: new Date(),
              attachments: [],
              chatId: id,
              moderation: currentMessage.experimental_metadata?.moderation || false,
            })),
          });
        }
      },
      onError: () => "Oops, an error occurred!",
    });

    return createUIMessageStreamResponse({
      stream,
      async consumeSseStream({ stream: sseStream }) {
        if (!process.env.REDIS_URL) {
          return;
        }
        try {
          const streamContext = getStreamContext();
          if (streamContext) {
            const streamId = generateId();
            await createStreamId({ streamId, chatId: id });
            await streamContext.createNewResumableStream(
              streamId,
              () => sseStream
            );
          }
        } catch (_) {
          // ignore redis errors
        }
      },
    });
  } catch (error) {
    const vercelId = request.headers.get("x-vercel-id");

    if (error instanceof ChatSDKError) {
      return error.toResponse();
    }

    if (
      error instanceof Error &&
      error.message?.includes(
        "AI Gateway requires a valid credit card on file to service requests"
      )
    ) {
      return new ChatSDKError("bad_request:activate_gateway").toResponse();
    }

    console.error("Unhandled error in chat API:", error, { vercelId });
    return new ChatSDKError("offline:chat").toResponse();
  }
}

export async function DELETE(request: Request) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");

  if (!id) {
    return new ChatSDKError("bad_request:api").toResponse();
  }

  const { userId } = await auth(); // This is Clerk's userId

  // Guest users cannot delete chats. Only logged-in users.
  if (!userId) {
    return new ChatSDKError("unauthorized:chat").toResponse();
  }

  const chat = await getChatById({ id });

  if (chat?.userId !== userId) {
    return new ChatSDKError("forbidden:chat").toResponse();
  }

  const deletedChat = await deleteChatById({ id });

  return Response.json(deletedChat, { status: 200 });
}
