import { AppSignUp } from "@/lib/auth/client";

export default function Page() {
  return (
    <div className="flex h-dvh w-screen items-center justify-center bg-background">
      <AppSignUp 
        appearance={{
          elements: {
            formButtonPrimary: "bg-primary text-primary-foreground hover:bg-primary/90",
            footerActionLink: "text-primary hover:text-primary/90",
          }
        }}
      />
    </div>
  );
}

