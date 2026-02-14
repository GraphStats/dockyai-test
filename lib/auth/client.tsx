"use client";

import type { ComponentProps, ReactNode } from "react";
import {
  AuthenticateWithRedirectCallback,
  ClerkProvider,
  SignIn,
  SignUp,
  useClerk,
  useUser,
} from "@clerk/nextjs";

const isClerkDisabled = process.env.NODE_ENV === "development";

export function AppClerkProvider({ children, ...props }: ComponentProps<typeof ClerkProvider>) {
  if (isClerkDisabled) {
    return <>{children}</>;
  }

  return <ClerkProvider {...props}>{children}</ClerkProvider>;
}

export function useAppUser() {
  if (isClerkDisabled) {
    return {
      isLoaded: true,
      isSignedIn: false,
      user: null,
    } as any;
  }

  return useUser();
}

export function useAppClerk() {
  if (isClerkDisabled) {
    return {
      signOut: async () => undefined,
    } as any;
  }

  return useClerk();
}

export function AppSignIn(props: ComponentProps<typeof SignIn>) {
  if (isClerkDisabled) {
    return (
      <div className="rounded-lg border p-6 text-center text-sm text-muted-foreground">
        Authentification desactivee en localhost.
      </div>
    );
  }

  return <SignIn {...props} />;
}

export function AppSignUp(props: ComponentProps<typeof SignUp>) {
  if (isClerkDisabled) {
    return (
      <div className="rounded-lg border p-6 text-center text-sm text-muted-foreground">
        Inscription desactivee en localhost.
      </div>
    );
  }

  return <SignUp {...props} />;
}

export function AppAuthenticateWithRedirectCallback(
  props: ComponentProps<typeof AuthenticateWithRedirectCallback>
) {
  if (isClerkDisabled) {
    return null;
  }

  return <AuthenticateWithRedirectCallback {...props} />;
}
