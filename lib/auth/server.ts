import { auth as clerkAuth } from "@clerk/nextjs/server";

const isClerkDisabled = process.env.NODE_ENV === "development";

export async function appAuth() {
  if (isClerkDisabled) {
    return {
      userId: null,
      sessionId: null,
      getToken: async () => null,
      has: () => false,
      debug: () => null,
      orgId: null,
      orgRole: null,
      orgSlug: null,
      actor: null,
      sessionClaims: null,
    } as any;
  }

  return clerkAuth();
}
