"use client";

import { AppShell } from "@/components/layout/app-shell";
import type { NavItemId } from "@/lib/homepage-types";

type QuestionsLayoutProps = {
  activeNavId?: NavItemId;
  children: React.ReactNode;
};

export function QuestionsLayout({
  activeNavId = "ask",
  children,
}: QuestionsLayoutProps) {
  return <AppShell activeNavId={activeNavId}>{children}</AppShell>;
}
