import "server-only";

import {
  and,
  asc,
  count,
  desc,
  eq,
  gt,
  gte,
  inArray,
  lt,
  type SQL,
} from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import type { ArtifactKind } from "@/components/artifact";
import type { VisibilityType } from "@/components/visibility-selector";
import { ChatSDKError } from "../errors";
import { generateUUID } from "../utils";
import { entitlementsByUserType, type UserType } from "@/lib/ai/entitlements";
import {
  type Chat,
  chat,
  type DBMessage,
  document,
  message,
  type Suggestion,
  stream,
  suggestion,
  type User,
  user,
  vote,
} from "./schema";
import { generateHashedPassword } from "./utils";

// Optionally, if not using email/pass login, you can
// use the Drizzle adapter for Auth.js / NextAuth
// https://authjs.dev/reference/adapter/drizzle

let client: any;
let db: any;

function getDb() {
  if (!db) {
    if (!process.env.POSTGRES_URL) {
      throw new ChatSDKError(
        "bad_request:database",
        "POSTGRES_URL environment variable is missing"
      );
    }
    client = postgres(process.env.POSTGRES_URL);
    db = drizzle(client);
  }
  return db;
}

const getDailyCreditsByUserType = (userType: UserType): number => {
  const value = entitlementsByUserType[userType].dailyCredits;
  return Number.isFinite(value) && value > 0 ? value : 1;
};

const isSameUtcDay = (left: Date, right: Date) =>
  left.getUTCFullYear() === right.getUTCFullYear() &&
  left.getUTCMonth() === right.getUTCMonth() &&
  left.getUTCDate() === right.getUTCDate();

export async function getUser(email: string): Promise<User[]> {
  try {
    const db = getDb();
    return await db.select().from(user).where(eq(user.email, email));
  } catch (_error) {
    if (_error instanceof ChatSDKError) throw _error;
    throw new ChatSDKError(
      "bad_request:database",
      "Failed to get user by email"
    );
  }
}

export async function getUserById(id: string): Promise<User[]> {
  try {
    const db = getDb();
    return await db.select().from(user).where(eq(user.id, id));
  } catch (_error) {
    console.error("Database error in getUserById:", _error);
    return [];
  }
}

export async function getOrCreateUser(
  id: string,
  email?: string,
  options?: { userType?: UserType }
): Promise<User> {
  const users = await getUserById(id);
  if (users.length > 0) {
    return users[0];
  }

  const userType = options?.userType ?? "regular";
  const dailyCredits = getDailyCreditsByUserType(userType);

  try {
    const db = getDb();
    const [newUser] = await db.insert(user).values({
      id,
      email: email || `user-${id}`,
      useLocation: true,
      customInstructions: "",
      referenceChatHistory: true,
      referenceMemories: true,
      dailyCreditsRemaining: dailyCredits,
      dailyCreditsResetAt: new Date(),
    }).returning();
    return newUser;
  } catch (error) {
    console.error("Failed to create user on the fly:", error);
    // Return a dummy user object if insertion fails
    return {
      id,
      email: email || `user-${id}`,
      customInstructions: "",
      useLocation: true,
      referenceChatHistory: true,
      referenceMemories: true,
      password: null,
      dailyCreditsRemaining: dailyCredits,
      dailyCreditsResetAt: new Date(),
    } as User;
  }
}

export async function updateUserById(id: string, values: Partial<User>) {
  try {
    const db = getDb();
    return await db.update(user).set(values).where(eq(user.id, id));
  } catch (_error) {
    throw new ChatSDKError("bad_request:database", "Failed to update user");
  }
}

export async function createUser(email: string, password: string) {
  const hashedPassword = generateHashedPassword(password);

  try {
    const db = getDb();
    return await db.insert(user).values({ email, password: hashedPassword });
  } catch (_error) {
    throw new ChatSDKError("bad_request:database", "Failed to create user");
  }
}

export async function createGuestUser() {
  const id = generateUUID(); // Generate ID for guest user
  const email = `guest-${Date.now()}`;
  const password = generateHashedPassword(id); // Use the ID to generate password
  const dailyCredits = getDailyCreditsByUserType("guest");

  try {
    const db = getDb();
    console.log("Creating guest user with email:", email);
    return await db.insert(user).values({
      id, // Include the generated ID
      email,
      password,
      useLocation: true,
      customInstructions: "",
      referenceChatHistory: true,
      referenceMemories: true,
      dailyCreditsRemaining: dailyCredits,
      dailyCreditsResetAt: new Date(),
    }).returning({
      id: user.id,
      email: user.email,
    });
  } catch (_error: any) {
    if (_error instanceof ChatSDKError) throw _error;
    console.error("Database error in createGuestUser:", _error);
    throw new ChatSDKError(
      "bad_request:database",
      `Failed to create guest user: ${_error.message || _error}`
    );
  }
}

export async function saveChat({
  id,
  userId,
  title,
  visibility,
}: {
  id: string;
  userId: string;
  title: string;
  visibility: VisibilityType;
}) {
  try {
    const db = getDb();
    return await db.insert(chat).values({
      id,
      createdAt: new Date(),
      userId,
      title,
      visibility,
    });
  } catch (_error) {
    throw new ChatSDKError("bad_request:database", "Failed to save chat");
  }
}

export async function deleteChatById({ id }: { id: string }) {
  try {
    const db = getDb();
    await db.delete(vote).where(eq(vote.chatId, id));
    await db.delete(message).where(eq(message.chatId, id));
    await db.delete(stream).where(eq(stream.chatId, id));

    const [chatsDeleted] = await db
      .delete(chat)
      .where(eq(chat.id, id))
      .returning();
    return chatsDeleted;
  } catch (_error) {
    throw new ChatSDKError(
      "bad_request:database",
      "Failed to delete chat by id"
    );
  }
}

export async function deleteAllChatsByUserId({ userId }: { userId: string }) {
  try {
    const db = getDb();
    const userChats = await db
      .select({ id: chat.id })
      .from(chat)
      .where(eq(chat.userId, userId));

    if (userChats.length === 0) {
      return { deletedCount: 0 };
    }

    const chatIds = userChats.map((c: any) => c.id);

    await db.delete(vote).where(inArray(vote.chatId, chatIds));
    await db.delete(message).where(inArray(message.chatId, chatIds));
    await db.delete(stream).where(inArray(stream.chatId, chatIds));

    const deletedChats = await db
      .delete(chat)
      .where(eq(chat.userId, userId))
      .returning();

    return { deletedCount: deletedChats.length };
  } catch (_error) {
    throw new ChatSDKError(
      "bad_request:database",
      "Failed to delete all chats by user id"
    );
  }
}

export async function getChatsByUserId({
  id,
  limit,
  startingAfter,
  endingBefore,
}: {
  id: string;
  limit: number;
  startingAfter: string | null;
  endingBefore: string | null;
}) {
  try {
    const db = getDb();
    const extendedLimit = limit + 1;

    const query = (whereCondition?: SQL<any>) => {
      return db
        .select()
        .from(chat)
        .where(
          whereCondition
            ? and(whereCondition, eq(chat.userId, id))
            : eq(chat.userId, id)
        )
        .orderBy(desc(chat.createdAt))
        .limit(extendedLimit);
    };

    let filteredChats: Chat[] = [];

    if (startingAfter) {
      const [selectedChat] = await db
        .select()
        .from(chat)
        .where(eq(chat.id, startingAfter))
        .limit(1);

      if (!selectedChat) {
        throw new ChatSDKError(
          "not_found:database",
          `Chat with id ${startingAfter} not found`
        );
      }

      filteredChats = await query(gt(chat.createdAt, selectedChat.createdAt));
    } else if (endingBefore) {
      const [selectedChat] = await db
        .select()
        .from(chat)
        .where(eq(chat.id, endingBefore))
        .limit(1);

      if (!selectedChat) {
        throw new ChatSDKError(
          "not_found:database",
          `Chat with id ${endingBefore} not found`
        );
      }

      filteredChats = await query(lt(chat.createdAt, selectedChat.createdAt));
    } else {
      filteredChats = await query();
    }

    const hasMore = filteredChats.length > limit;

    return {
      chats: hasMore ? filteredChats.slice(0, limit) : filteredChats,
      hasMore,
    };
  } catch (_error) {
    throw new ChatSDKError(
      "bad_request:database",
      "Failed to get chats by user id"
    );
  }
}

export async function getChatById({ id }: { id: string }) {
  try {
    const db = getDb();
    const [selectedChat] = await db.select().from(chat).where(eq(chat.id, id));
    if (!selectedChat) {
      return null;
    }

    return selectedChat;
  } catch (_error) {
    throw new ChatSDKError("bad_request:database", "Failed to get chat by id");
  }
}

export async function saveMessages({ messages }: { messages: DBMessage[] }) {
  try {
    const db = getDb();
    return await db.insert(message).values(messages);
  } catch (_error) {
    throw new ChatSDKError("bad_request:database", "Failed to save messages");
  }
}

export async function updateMessage({
  id,
  parts,
}: {
  id: string;
  parts: DBMessage["parts"];
}) {
  try {
    const db = getDb();
    return await db.update(message).set({ parts }).where(eq(message.id, id));
  } catch (_error) {
    throw new ChatSDKError("bad_request:database", "Failed to update message");
  }
}

export async function getMessagesByChatId({ id }: { id: string }) {
  try {
    const db = getDb();
    return await db
      .select()
      .from(message)
      .where(eq(message.chatId, id))
      .orderBy(asc(message.createdAt));
  } catch (_error) {
    throw new ChatSDKError(
      "bad_request:database",
      "Failed to get messages by chat id"
    );
  }
}

export async function voteMessage({
  chatId,
  messageId,
  type,
}: {
  chatId: string;
  messageId: string;
  type: "up" | "down";
}) {
  try {
    const db = getDb();
    const [existingVote] = await db
      .select()
      .from(vote)
      .where(and(eq(vote.messageId, messageId)));

    if (existingVote) {
      return await db
        .update(vote)
        .set({ isUpvoted: type === "up" })
        .where(and(eq(vote.messageId, messageId), eq(vote.chatId, chatId)));
    }
    return await db.insert(vote).values({
      chatId,
      messageId,
      isUpvoted: type === "up",
    });
  } catch (_error) {
    throw new ChatSDKError("bad_request:database", "Failed to vote message");
  }
}

export async function getVotesByChatId({ id }: { id: string }) {
  try {
    const db = getDb();
    return await db.select().from(vote).where(eq(vote.chatId, id));
  } catch (_error) {
    throw new ChatSDKError(
      "bad_request:database",
      "Failed to get votes by chat id"
    );
  }
}

export async function saveDocument({
  id,
  title,
  kind,
  content,
  userId,
}: {
  id: string;
  title: string;
  kind: ArtifactKind;
  content: string;
  userId: string;
}) {
  try {
    const db = getDb();
    return await db
      .insert(document)
      .values({
        id,
        title,
        kind,
        content,
        userId,
        createdAt: new Date(),
      })
      .returning();
  } catch (_error) {
    throw new ChatSDKError("bad_request:database", "Failed to save document");
  }
}

export async function getDocumentsById({ id }: { id: string }) {
  try {
    const db = getDb();
    const documents = await db
      .select()
      .from(document)
      .where(eq(document.id, id))
      .orderBy(asc(document.createdAt));

    return documents;
  } catch (_error) {
    throw new ChatSDKError(
      "bad_request:database",
      "Failed to get documents by id"
    );
  }
}

export async function getDocumentById({ id }: { id: string }) {
  try {
    const db = getDb();
    const [selectedDocument] = await db
      .select()
      .from(document)
      .where(eq(document.id, id))
      .orderBy(desc(document.createdAt));

    return selectedDocument;
  } catch (_error) {
    throw new ChatSDKError(
      "bad_request:database",
      "Failed to get document by id"
    );
  }
}

export async function deleteDocumentsByIdAfterTimestamp({
  id,
  timestamp,
}: {
  id: string;
  timestamp: Date;
}) {
  try {
    const db = getDb();
    await db
      .delete(suggestion)
      .where(
        and(
          eq(suggestion.documentId, id),
          gt(suggestion.documentCreatedAt, timestamp)
        )
      );

    return await db
      .delete(document)
      .where(and(eq(document.id, id), gt(document.createdAt, timestamp)))
      .returning();
  } catch (_error) {
    throw new ChatSDKError(
      "bad_request:database",
      "Failed to delete documents by id after timestamp"
    );
  }
}

export async function saveSuggestions({
  suggestions,
}: {
  suggestions: Suggestion[];
}) {
  try {
    const db = getDb();
    return await db.insert(suggestion).values(suggestions);
  } catch (_error) {
    throw new ChatSDKError(
      "bad_request:database",
      "Failed to save suggestions"
    );
  }
}

export async function getSuggestionsByDocumentId({
  documentId,
}: {
  documentId: string;
}) {
  try {
    const db = getDb();
    return await db
      .select()
      .from(suggestion)
      .where(eq(suggestion.documentId, documentId));
  } catch (_error) {
    throw new ChatSDKError(
      "bad_request:database",
      "Failed to get suggestions by document id"
    );
  }
}

export async function getMessageById({ id }: { id: string }) {
  try {
    const db = getDb();
    return await db.select().from(message).where(eq(message.id, id));
  } catch (_error) {
    throw new ChatSDKError(
      "bad_request:database",
      "Failed to get message by id"
    );
  }
}

export async function updateMessageModerationById({ id }: { id:string }) {
  try {
    const db = getDb();
    return await db
      .update(message)
      .set({ moderation: true })
      .where(eq(message.id, id));
  } catch (_error) {
    throw new ChatSDKError(
      "bad_request:database",
      "Failed to update message moderation by id"
    );
  }
}

export async function deleteMessagesByChatIdAfterTimestamp({
  chatId,
  timestamp,
}: {
  chatId: string;
  timestamp: Date;
}) {
  try {
    const db = getDb();
    const messagesToDelete = await db
      .select({ id: message.id })
      .from(message)
      .where(
        and(eq(message.chatId, chatId), gte(message.createdAt, timestamp))
      );

    const messageIds = messagesToDelete.map(
      (currentMessage: any) => currentMessage.id
    );

    if (messageIds.length > 0) {
      await db
        .delete(vote)
        .where(
          and(eq(vote.chatId, chatId), inArray(vote.messageId, messageIds))
        );

      return await db
        .delete(message)
        .where(
          and(eq(message.chatId, chatId), inArray(message.id, messageIds))
        );
    }
  } catch (_error) {
    throw new ChatSDKError(
      "bad_request:database",
      "Failed to delete messages by chat id after timestamp"
    );
  }
}

export async function updateChatVisibilityById({
  chatId,
  visibility,
}: {
  chatId: string;
  visibility: "private" | "public";
}) {
  try {
    const db = getDb();
    return await db.update(chat).set({ visibility }).where(eq(chat.id, chatId));
  } catch (_error) {
    throw new ChatSDKError(
      "bad_request:database",
      "Failed to update chat visibility by id"
    );
  }
}

export async function updateChatTitleById({
  chatId,
  title,
}: {
  chatId: string;
  title: string;
}) {
  try {
    const db = getDb();
    return await db.update(chat).set({ title }).where(eq(chat.id, chatId));
  } catch (error) {
    console.warn("Failed to update title for chat", chatId, error);
    return;
  }
}

export async function getMessageCountByUserId({
  id,
  differenceInHours,
}: {
  id: string;
  differenceInHours: number;
}) {
  try {
    const db = getDb();
    const twentyFourHoursAgo = new Date(
      Date.now() - differenceInHours * 60 * 60 * 1000
    );

    const [stats] = await db
      .select({ count: count(message.id) })
      .from(message)
      .innerJoin(chat, eq(message.chatId, chat.id))
      .where(
        and(
          eq(chat.userId, id),
          gte(message.createdAt, twentyFourHoursAgo),
          eq(message.role, "user")
        )
      )
      .execute();

    return stats?.count ?? 0;
  } catch (_error) {
    throw new ChatSDKError(
      "bad_request:database",
      "Failed to get message count by user id"
    );
  }
}

export async function consumeDailyCreditsByUserId({
  id,
  userType,
  amount,
}: {
  id: string;
  userType: UserType;
  amount: number;
}) {
  try {
    const db = getDb();
    const today = new Date();
    const dailyCredits = getDailyCreditsByUserType(userType);

    return await db.transaction(async (tx: any) => {
      const [existingUser] = await tx
        .select({
          id: user.id,
          dailyCreditsRemaining: user.dailyCreditsRemaining,
          dailyCreditsResetAt: user.dailyCreditsResetAt,
        })
        .from(user)
        .where(eq(user.id, id))
        .limit(1);

      if (!existingUser) {
        throw new ChatSDKError("not_found:chat", "User not found for credit update");
      }

      const lastReset =
        existingUser.dailyCreditsResetAt instanceof Date
          ? existingUser.dailyCreditsResetAt
          : new Date(existingUser.dailyCreditsResetAt);
      const shouldReset = !lastReset || !isSameUtcDay(lastReset, today);
      const availableBeforeCharge = shouldReset
        ? dailyCredits
        : existingUser.dailyCreditsRemaining;

      if (availableBeforeCharge < amount) {
        if (shouldReset) {
          await tx
            .update(user)
            .set({
              dailyCreditsRemaining: dailyCredits,
              dailyCreditsResetAt: today,
            })
            .where(eq(user.id, id));
        }

        return {
          allowed: false,
          remainingCredits: availableBeforeCharge,
          dailyCredits,
          amount,
        };
      }

      const remainingCredits = availableBeforeCharge - amount;

      await tx
        .update(user)
        .set({
          dailyCreditsRemaining: remainingCredits,
          dailyCreditsResetAt: shouldReset ? today : lastReset,
        })
        .where(eq(user.id, id));

      return {
        allowed: true,
        remainingCredits,
        dailyCredits,
        amount,
      };
    });
  } catch (_error) {
    if (_error instanceof ChatSDKError) throw _error;
    throw new ChatSDKError(
      "bad_request:database",
      "Failed to consume daily credits by user id"
    );
  }
}

export async function getDailyCreditsStateByUserId({
  id,
  userType,
}: {
  id: string;
  userType: UserType;
}) {
  try {
    const db = getDb();
    const today = new Date();
    const dailyCredits = getDailyCreditsByUserType(userType);

    return await db.transaction(async (tx: any) => {
      const [existingUser] = await tx
        .select({
          id: user.id,
          dailyCreditsRemaining: user.dailyCreditsRemaining,
          dailyCreditsResetAt: user.dailyCreditsResetAt,
        })
        .from(user)
        .where(eq(user.id, id))
        .limit(1);

      if (!existingUser) {
        throw new ChatSDKError("not_found:chat", "User not found for credit state");
      }

      const lastReset =
        existingUser.dailyCreditsResetAt instanceof Date
          ? existingUser.dailyCreditsResetAt
          : new Date(existingUser.dailyCreditsResetAt);
      const shouldReset = !lastReset || !isSameUtcDay(lastReset, today);

      if (shouldReset) {
        await tx
          .update(user)
          .set({
            dailyCreditsRemaining: dailyCredits,
            dailyCreditsResetAt: today,
          })
          .where(eq(user.id, id));

        return {
          remainingCredits: dailyCredits,
          dailyCredits,
          resetAt: today,
        };
      }

      return {
        remainingCredits: existingUser.dailyCreditsRemaining,
        dailyCredits,
        resetAt: lastReset,
      };
    });
  } catch (_error) {
    if (_error instanceof ChatSDKError) throw _error;
    throw new ChatSDKError(
      "bad_request:database",
      "Failed to get daily credits state by user id"
    );
  }
}

export async function createStreamId({
  streamId,
  chatId,
}: {
  streamId: string;
  chatId: string;
}) {
  try {
    const db = getDb();
    await db
      .insert(stream)
      .values({ id: streamId, chatId, createdAt: new Date() });
  } catch (_error) {
    throw new ChatSDKError(
      "bad_request:database",
      "Failed to create stream id"
    );
  }
}

export async function getStreamIdsByChatId({ chatId }: { chatId: string }) {
  try {
    const db = getDb();
    const streamIds = await db
      .select({ id: stream.id })
      .from(stream)
      .where(eq(stream.chatId, chatId))
      .orderBy(asc(stream.createdAt))
      .execute();

    return streamIds.map(({ id }: any) => id);
  } catch (_error) {
    throw new ChatSDKError(
      "bad_request:database",
      "Failed to get stream ids by chat id"
    );
  }
}
