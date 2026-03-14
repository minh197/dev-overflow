"use client";

import { LeftSidebar } from "@/components/home/left-sidebar";
import { RightRail } from "@/components/home/right-rail";
import { TopSearch } from "@/components/home/top-search";
import {
  fetchAuthMe,
  fetchHotNetwork,
  fetchPopularTags,
} from "@/lib/api/homepage-api";
import type { NavItem } from "@/lib/homepage-types";
import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";

const baseNavItems: NavItem[] = [
  { id: "home", label: "Home", href: "/" },
  { id: "collections", label: "Collections", href: "#" },
  { id: "jobs", label: "Find Jobs", href: "#" },
  { id: "tags", label: "Tags", href: "#" },
  { id: "communities", label: "Communities", href: "#" },
  { id: "ask", label: "Ask a Question", href: "/questions/ask" },
];

function getInitials(nameOrUsername: string) {
  const chunks = nameOrUsername.split(/\s+/).filter(Boolean);
  if (chunks.length === 0) return "U";
  if (chunks.length === 1) return chunks[0].slice(0, 2).toUpperCase();
  return `${chunks[0][0]}${chunks[1][0]}`.toUpperCase();
}

type QuestionsLayoutProps = {
  activeNavId?: string;
  children: React.ReactNode;
};

export function QuestionsLayout({
  activeNavId = "ask",
  children,
}: QuestionsLayoutProps) {
  const {
    data: hotNetwork = [],
    isError: isHotError,
  } = useQuery({
    queryKey: ["homepage-hot-network"],
    queryFn: fetchHotNetwork,
  });

  const {
    data: popularTags = [],
    isError: isPopularTagsError,
  } = useQuery({
    queryKey: ["homepage-popular-tags"],
    queryFn: fetchPopularTags,
  });

  const { data: authMe } = useQuery({
    queryKey: ["auth-me"],
    queryFn: fetchAuthMe,
  });

  const navItems = useMemo(
    () =>
      baseNavItems.map((item) => ({
        ...item,
        active: item.id === activeNavId,
      })),
    [activeNavId],
  );

  const userInitials = useMemo(
    () => getInitials(authMe?.fullName ?? authMe?.username ?? "JS"),
    [authMe?.fullName, authMe?.username],
  );

  return (
    <div className="min-h-screen bg-[var(--app-bg)] text-[var(--text-muted)]">
      <div className="mx-auto flex max-w-[1400px]">
        <LeftSidebar navItems={navItems} />

        <main className="flex min-h-screen flex-1 gap-6 px-6 py-5">
          <section className="min-w-0 flex-1">
            <TopSearch
              placeholder="Search for Questions Here..."
              userInitials={userInitials}
            />
            {children}
          </section>

          <div className="space-y-3">
            {(isHotError || isPopularTagsError) && (
              <div className="hidden rounded-xl border border-amber-400/20 bg-amber-500/10 p-3 text-xs text-amber-100 lg:block">
                Some sidebar data is temporarily unavailable.
              </div>
            )}
            <RightRail hotNetwork={hotNetwork} popularTags={popularTags} />
          </div>
        </main>
      </div>
    </div>
  );
}
