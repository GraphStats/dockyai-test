"use client";

import { AppAuthenticateWithRedirectCallback } from "@/lib/auth/client";

export default function LoginSSOCallback() {
  return (
    <div className="flex h-dvh w-screen items-center justify-center bg-background">
      <div className="flex flex-col items-center gap-3 text-center">
        <div className="size-8 animate-spin rounded-full border-4 border-zinc-300 border-t-zinc-900 dark:border-zinc-700 dark:border-t-zinc-100" />
        <p className="text-sm text-muted-foreground">Finalisation de la connexion...</p>
      </div>
      <AppAuthenticateWithRedirectCallback
        signInFallbackRedirectUrl="/chat"
        signUpFallbackRedirectUrl="/chat"
      />
    </div>
  );
}

