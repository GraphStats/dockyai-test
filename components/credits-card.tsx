"use client";

import Link from "next/link";
import useSWR from "swr";
import { CoinsIcon } from "lucide-react";
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";

type CreditsResponse = {
  remainingCredits: number;
  dailyCredits: number;
  resetAt: string;
  userType: "guest" | "regular";
};

const fetcher = async (url: string) => {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error("Failed to load credits");
  }
  return (await response.json()) as CreditsResponse;
};

export function CreditsCard() {
  const { data, error, isLoading } = useSWR<CreditsResponse>(
    "/api/credits",
    fetcher,
    {
      revalidateOnFocus: true,
    }
  );

  const remaining = data?.remainingCredits ?? 0;
  const total = data?.dailyCredits ?? 0;

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <SidebarMenuButton asChild className="h-12 bg-background" variant="outline">
          <Link href="/stats">
            <CoinsIcon className="size-4" />
            <div className="flex min-w-0 flex-1 flex-col leading-tight">
              <span className="truncate text-xs text-muted-foreground">Credits</span>
              <span className="truncate font-medium text-sm">
                {isLoading
                  ? "Loading..."
                  : error
                    ? "Indisponible"
                    : `${remaining} / ${total}`}
              </span>
            </div>
          </Link>
        </SidebarMenuButton>
      </SidebarMenuItem>
    </SidebarMenu>
  );
}
