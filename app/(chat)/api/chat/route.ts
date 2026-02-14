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
import { appAuth } from "@/lib/auth/server";
import { type UserType } from "@/lib/ai/entitlements";
import {
  artifactsPrompt,
  type RequestHints,
  systemPrompt,
} from "@/lib/ai/prompts";
import {
  getLanguageModelFallbackChain,
  hasHuggingFaceApiKeyConfigured,
} from "@/lib/ai/providers";
import { createDocument } from "@/lib/ai/tools/create-document";
import { getWeather } from "@/lib/ai/tools/get-weather";
import { requestSuggestions } from "@/lib/ai/tools/request-suggestions";
import { updateDocument } from "@/lib/ai/tools/update-document";
import { isProductionEnvironment } from "@/lib/constants";
import {
  AUTO_MODEL_ID,
  DEFAULT_CHAT_MODEL,
  getEffectiveModelCreditCost,
  supportsTools,
  chatModels,
  visionSupportedModelIds,
} from "@/lib/ai/models";
import {
  consumeDailyCreditsByUserId,
  createStreamId,
  deleteChatById,
  getChatById,
  getHfPricingState,
  getMessagesByChatId,
  getOrCreateUser,
  logModelUsage,
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
import { checkMessageWithAI, type ModerationDecision } from "@/lib/ai/moderation-ai"; // Import the AI moderation utility
import { type PostRequestBody, postRequestBodySchema } from "./schema";
import { z } from "zod";

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

function isHfRetryableError(error: unknown) {
  const message = (error as { message?: string })?.message?.toLowerCase() ?? "";

  return (
    message.includes("credit card") ||
    message.includes("quota") ||
    message.includes("rate limit") ||
    message.includes("too many requests") ||
    message.includes("unauthorized") ||
    message.includes("forbidden") ||
    message.includes("status 401") ||
    message.includes("status 402") ||
    message.includes("status 403") ||
    message.includes("status 429") ||
    message.includes("status 5")
  );
}

export async function POST(request: Request) {
  let requestBody: PostRequestBody;

  try {
    const json = await request.json();
    requestBody = postRequestBodySchema.parse(json);
  } catch (error) {
    console.error("Failed to parse or validate request body for /api/chat:", error);
    // If it's a ZodError, we can extract more details
    if (error instanceof z.ZodError) {
        console.error("Zod validation errors:", error.errors);
    }
    return new ChatSDKError("bad_request:api").toResponse();
  }

  try {
    const { id, message, messages, selectedChatModel, selectedVisibilityType } =
      requestBody;

    if (!process.env.POSTGRES_URL) {
      return new ChatSDKError(
        "bad_request:api",
        "POSTGRES_URL is missing. Please add it to your environment variables."
      ).toResponse();
    }

    if (!hasHuggingFaceApiKeyConfigured()) {
      return new ChatSDKError(
        "bad_request:api",
        "No Hugging Face API key configured. Add HUGGING_FACE_API_KEY or HUGGING_FACE_API_KEYS."
      ).toResponse();
    }

    const { userId: clerkUserId } = await appAuth(); // Rename to avoid conflict

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
      await getOrCreateUser(currentUserId, undefined, { userType });
    } catch (dbError) {
      console.error("Failed to provision user in local DB:", dbError);
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

    // Inline file data (base64) for image/file parts so providers can consume them
    const inlineFileData = async (msgs: ChatMessage[]) =>
      Promise.all(
        msgs.map(async (msg) => ({
          ...msg,
          parts: await Promise.all(
            msg.parts.map(async (part) => {
              if (
                part.type === "file" &&
                "url" in part &&
                part.url &&
                !("data" in part)
              ) {
                try {
                  const res = await fetch(part.url);
                  const buf = Buffer.from(await res.arrayBuffer());
                  return {
                    ...part,
                    data: buf.toString("base64"),
                  };
                } catch (err) {
                  console.error("Failed to inline file data:", err);
                  return part;
                }
              }
              return part;
            })
          ),
        }))
      );

    const uiMessagesWithFiles = await inlineFileData(uiMessages);

    const { longitude, latitude, city, country } = geolocation(request);

    const requestHints: RequestHints = {
      longitude,
      latitude,
      city,
      country,
    };

    let userModerationDecision: ModerationDecision = "allow";
    if (message?.role === "user") {
      const userMessageText = message.parts
        .filter((part) => part.type === "text" && part.text)
        .map((part) => (part as { text: string }).text)
        .join(" ");

      userModerationDecision = await checkMessageWithAI(userMessageText);
      if (userModerationDecision === "block") {
        console.warn(`AI moderation blocked user message: "${userMessageText}"`);
        throw new ChatSDKError("forbidden:content");
      }
    }

    const isReasoningModel =
      selectedChatModel.includes("reasoning") ||
      selectedChatModel.includes("thinking");

    // Validate the requested model against the allowed list; if invalid, reject early (no fallback).
    const isKnownModel =
      selectedChatModel === AUTO_MODEL_ID ||
      chatModels.some((model) => model.id === selectedChatModel);
    if (!isKnownModel) {
      return new ChatSDKError(
        "bad_request:api",
        `Unsupported model "${selectedChatModel}".`
      ).toResponse();
    }

    const hasImages = uiMessagesWithFiles.some((m) =>
      m.parts.some(
        (p) => p.type === "file" && p.mediaType?.startsWith("image/")
      )
    );

    // Determine model & capabilities
    const pickAutoModel = () => {
      // 1) Vision takes priority if images present
      if (hasImages && visionSupportedModelIds.size > 0) {
        return Array.from(visionSupportedModelIds)[0];
      }

      // 2) Heuristics based on user text
      const userText =
        (message?.parts
          ?.filter((p) => p.type === "text" && "text" in p)
          .map((p: any) => p.text)
          .join(" ")
          .toLowerCase() ?? "");

      const looksLikeCode =
        /function|const\s+\w+\s*=\s*\(|class\s+\w+|def\s+\w+|import\s+\w+/.test(
          userText
        ) || /```/.test(userText);

      if (looksLikeCode) {
        const coder =
          chatModels.find((m) =>
            m.id.toLowerCase().includes("coder")
          )?.id || chatModels.find((m) => m.id !== AUTO_MODEL_ID)?.id;
        if (coder) return coder;
      }

      // 3) Default strong general model
      const general =
        chatModels.find((m) => m.id === "openai/gpt-oss-120b")?.id ||
        chatModels.find((m) => m.id === "google/gemma-3-27b-it")?.id ||
        chatModels.find((m) => m.id !== AUTO_MODEL_ID)?.id;

      return general ?? DEFAULT_CHAT_MODEL;
    };

    let effectiveModelId =
      selectedChatModel === AUTO_MODEL_ID ? pickAutoModel() : selectedChatModel;
    let effectiveModelSupportsTools = supportsTools(effectiveModelId);

    // Block images on non-vision models; if a vision model is available, auto-switch with notice

    if (hasImages && !visionSupportedModelIds.has(effectiveModelId)) {
      const availableVision = Array.from(visionSupportedModelIds)[0];
      if (availableVision) {
        effectiveModelId = availableVision;
        effectiveModelSupportsTools = supportsTools(effectiveModelId);
      } else {
        const warningStream = createUIMessageStream({
          originalMessages: uiMessagesWithFiles,
          execute: async ({ writer }) => {
            writer.write({
              type: "data-textDelta",
              data: `ℹ️ Aucun modèle vision disponible pour traiter les images (modèle actuel: "${selectedChatModel}").`,
              transient: true,
            });
          },
          generateId: generateUUID,
        });
        return createUIMessageStreamResponse({ stream: warningStream });
      }
    }

    if (!isToolApprovalFlow && message?.role === "user") {
      const hfPricingState = await getHfPricingState();
      const creditsToConsume = getEffectiveModelCreditCost({
        modelId: effectiveModelId,
        multiplier: hfPricingState.activeMultiplier,
      });
      const creditsResult = await consumeDailyCreditsByUserId({
        id: currentUserId,
        userType,
        amount: creditsToConsume,
      });

      if (!creditsResult.allowed) {
        return new ChatSDKError(
          "rate_limit:chat",
          `Insufficient credits: ${creditsResult.remainingCredits}/${creditsResult.dailyCredits} available, requires ${creditsToConsume}. Borrow available: ${creditsResult.borrowAvailable ?? 0}`
        ).toResponse();
      }

      await logModelUsage({
        userId: currentUserId,
        modelId: effectiveModelId,
        coinsCharged: creditsToConsume,
      });

      await saveMessages({
        messages: [
          {
            chatId: id,
            id: message.id,
            role: "user",
            parts: message.parts,
            attachments: [],
            createdAt: new Date(),
            moderation: userModerationDecision === "review",
          },
        ],
      });
    }

    let userData = null;
    try {
      userData = await getOrCreateUser(currentUserId, undefined, { userType }); // Use currentUserId
    } catch (dbError) {
      console.error("Failed to fetch or create user, using defaults:", dbError);
    }

    const shouldUseChatHistory = userData?.referenceChatHistory ?? true;
    const modelInputMessages = shouldUseChatHistory
      ? uiMessagesWithFiles
      : uiMessagesWithFiles.slice(-1);

    const modelMessages = await convertToModelMessages(modelInputMessages);

    const stream = createUIMessageStream({
      originalMessages: isToolApprovalFlow ? uiMessages : undefined,
      execute: async ({ writer: dataStream }) => {
        console.log("Starting stream with model:", selectedChatModel);

        try {
          // Inform UI (transient) about the model actually used
          dataStream.write({
            type: "data-textDelta",
            data: `Modèle utilisé: ${effectiveModelId}`,
            transient: true,
          });

          const modelFallbackChain = getLanguageModelFallbackChain(effectiveModelId);
          if (modelFallbackChain.length === 0) {
            throw new Error("No HF model clients available");
          }

          let result: any = null;
          let lastError: unknown = null;

          for (let i = 0; i < modelFallbackChain.length; i++) {
            const modelCandidate = modelFallbackChain[i];
            try {
              result = await streamText({
                model: modelCandidate,
                system:
                  systemPrompt({
                    selectedChatModel: effectiveModelId,
                    requestHints,
                    customInstructions: userData?.customInstructions || undefined,
                    useLocation: userData?.useLocation ?? true,
                    referenceChatHistory: userData?.referenceChatHistory ?? true,
                    referenceMemories: userData?.referenceMemories ?? true,
                  }) +
                  (effectiveModelSupportsTools
                    ? `\n\n${artifactsPrompt}`
                    : "\n\nTools are disabled for this model; respond directly without tool calls."),
                messages: modelMessages,
                stopWhen: stepCountIs(5),
                experimental_activeTools: effectiveModelSupportsTools
                  ? [
                      "getWeather",
                      "createDocument",
                      "updateDocument",
                      "requestSuggestions",
                    ]
                  : undefined,
                providerOptions: isReasoningModel
                  ? {
                      anthropic: {
                        thinking: { type: "enabled", budgetTokens: 10_000 },
                      },
                    }
                  : undefined,
                toolChoice: effectiveModelSupportsTools ? "auto" : "none",
                tools: effectiveModelSupportsTools
                  ? {
                      getWeather,
                      createDocument: createDocument({
                        userId: currentUserId,
                        dataStream,
                      }),
                      updateDocument: updateDocument({
                        userId: currentUserId,
                        dataStream,
                      }),
                      requestSuggestions: requestSuggestions({
                        userId: currentUserId,
                        dataStream,
                      }),
                    }
                  : undefined,
                experimental_telemetry: {
                  isEnabled: isProductionEnvironment,
                  functionId: "stream-text",
                },
              });
              break;
            } catch (error) {
              lastError = error;
              const canRetry =
                i < modelFallbackChain.length - 1 && isHfRetryableError(error);
              if (!canRetry) {
                throw error;
              }
            }
          }

          if (!result) {
            throw (lastError ?? new Error("Failed to initialize model stream"));
          }

          // Stream immediately for real-time typing
          dataStream.merge(result.toUIMessageStream({ sendReasoning: true }));

          // AI Moderation for AI-generated messages (post-stream)
          const aiResponse = await result.text; // full text after stream
          const aiModerationDecision: ModerationDecision = await checkMessageWithAI(aiResponse);

          if (aiModerationDecision === "block") {
            console.warn(`AI moderation blocked unsafe AI response: "${aiResponse}"`);
            dataStream.write({
              type: "data-textDelta",
              data: "Message modéré : le contenu a été jugé inapproprié.",
              transient: true,
            });
            dataStream.write({
              type: "message-metadata",
              messageMetadata: { moderation: true, createdAt: new Date().toISOString() },
            });
            // The AI message will be saved with the moderation flag in onFinish below
          } else if (aiModerationDecision === "review") {
            dataStream.write({
              type: "message-metadata",
              messageMetadata: { moderation: true, createdAt: new Date().toISOString() },
            });
          }

          if (titlePromise) {
            const title = await titlePromise;
            dataStream.write({ type: "data-chat-title", data: title });
            updateChatTitleById({ chatId: id, title });
          }

          if (!effectiveModelSupportsTools) {
            dataStream.write({
              type: "data-textDelta",
              data: `ℹ️ Le modèle "${selectedChatModel}" ne prend pas en charge les tools. Réponse sans tools.`,
              transient: true,
            });
          }
        } catch (err: any) {
          console.error("Error during stream execution:", err);
          dataStream.write({
            type: "data-textDelta",
            data: `Erreur modèle "${selectedChatModel}" : ${err.message ?? "inconnue"}`,
            transient: true,
          });
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
                                      moderation: (finishedMsg as ChatMessage).experimental_metadata?.moderation || false, // Set moderation flag
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
              moderation: (currentMessage as ChatMessage).experimental_metadata?.moderation || false,
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

  const { userId } = await appAuth(); // This is Clerk's userId

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


