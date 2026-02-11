"use client";

import { AuthenticateWithRedirectCallback } from "@clerk/nextjs";

export default function RegisterSSOCallback() {
  return (
    <div className="flex h-dvh w-screen items-center justify-center bg-background">
      <div className="flex flex-col items-center gap-3 text-center">
        <div className="size-8 animate-spin rounded-full border-4 border-zinc-300 border-t-zinc-900 dark:border-zinc-700 dark:border-t-zinc-100" />
        <p className="text-sm text-muted-foreground">Finalisation de l'inscription...</p>
      </div>
      <AuthenticateWithRedirectCallback
        signInFallbackRedirectUrl="/chat"
        signUpFallbackRedirectUrl="/chat"
      />
    </div>
  );
}
