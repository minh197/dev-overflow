"use client";

import { useQuery } from "@tanstack/react-query";
import { Suspense, useMemo } from "react";

import { LeftSidebar } from "@/components/home/left-sidebar";
import { RightRail } from "@/components/home/right-rail";
import { GlobalSearch } from "@/components/layout/global-search";
import {
  fetchHotNetwork,
  fetchPopularTags,
} from "@/lib/api/homepage-api";
import { fetchAuthMe } from "@/lib/api/auth-api";
import type { NavItemId } from "@/lib/homepage-types";
import { getInitials, getNavItems } from "@/lib/navigation";

type AppShellProps = {
  activeNavId?: NavItemId;
  searchPlaceholder?: string;
  children: React.ReactNode;
};

export function AppShell({
  activeNavId = "home",
  searchPlaceholder = "Search anything globally",
  children,
}: AppShellProps) {
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
    staleTime: 30_000,
  });

  const navItems = useMemo(() => getNavItems(activeNavId), [activeNavId]);
  const userInitials = useMemo(
    () => getInitials(authMe?.fullName ?? authMe?.username ?? "JS"),
    [authMe?.fullName, authMe?.username],
  );

  return (
    <div className="min-h-screen bg-[var(--app-bg)] text-[var(--text-muted)]">
      <div className="mx-auto flex max-w-[1400px]">
        <LeftSidebar navItems={navItems} authUser={authMe} />

        <main className="flex min-h-screen flex-1 gap-6 px-6 py-5">
          <section className="min-w-0 flex-1">
            <Suspense fallback={null}>
              <GlobalSearch
                placeholder={searchPlaceholder}
                userInitials={userInitials}
                authUser={authMe}
              />
            </Suspense>
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
