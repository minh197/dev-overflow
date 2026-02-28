"use client";

import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";

import { FeedFilters } from "@/components/home/feed-filters";
import { LeftSidebar } from "@/components/home/left-sidebar";
import { QuestionCard } from "@/components/home/question-card";
import { RightRail } from "@/components/home/right-rail";
import { TopSearch } from "@/components/home/top-search";
import {
  fetchAuthMe,
  fetchHomepageQuestions,
  fetchHotNetwork,
  fetchPopularTags,
} from "@/lib/api/homepage-api";
import type {
  FeedFilter,
  FeedFilterKey,
  NavItem,
  QuestionSummary,
} from "@/lib/homepage-types";

const navItems: NavItem[] = [
  { id: "home", label: "Home", href: "#", active: true },
  { id: "collections", label: "Collections", href: "#" },
  { id: "jobs", label: "Find Jobs", href: "#" },
  { id: "tags", label: "Tags", href: "#" },
  { id: "communities", label: "Communities", href: "#" },
  { id: "ask", label: "Ask a Question", href: "#" },
  { id: "recommended", label: "Recommended Qs", href: "#" },
];

const filters: FeedFilter[] = [
  { key: "newest", label: "Newest" },
  { key: "recommended", label: "Recommended Questions" },
  { key: "frequent", label: "Frequent" },
  { key: "unanswered", label: "Unanswered" },
];

function getInitials(nameOrUsername: string) {
  const chunks = nameOrUsername.split(/\s+/).filter(Boolean);
  if (chunks.length === 0) return "U";
  if (chunks.length === 1) return chunks[0].slice(0, 2).toUpperCase();
  return `${chunks[0][0]}${chunks[1][0]}`.toUpperCase();
}

export function HomepageDesktop() {
  const [activeFilter, setActiveFilter] = useState<FeedFilterKey>("newest");

  const {
    data: questions = [],
    isLoading: isQuestionsLoading,
    isError: isQuestionsError,
  } = useQuery<QuestionSummary[]>({
    queryKey: ["homepage-questions", activeFilter],
    queryFn: () => fetchHomepageQuestions(activeFilter),
  });

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
            <TopSearch userInitials={userInitials} />

            <div className="mb-6 flex items-center justify-between gap-3">
              <h1 className="text-3xl font-semibold text-[var(--text-strong)]">
                All Questions
              </h1>
              <button
                type="button"
                className="rounded-xl bg-[var(--accent)] px-4 py-2 text-sm font-medium text-black transition-opacity hover:opacity-90"
              >
                Ask a Question
              </button>
            </div>

            <FeedFilters
              items={filters}
              activeFilter={activeFilter}
              onFilterChange={setActiveFilter}
            />

            <div className="space-y-4">
              {isQuestionsLoading && (
                <div className="rounded-2xl border border-white/10 bg-[var(--surface)] p-4 text-sm text-[var(--text-soft)]">
                  Loading questions...
                </div>
              )}
              {isQuestionsError && (
                <div className="rounded-2xl border border-red-400/20 bg-red-500/10 p-4 text-sm text-red-200">
                  Failed to load questions. Please refresh and try again.
                </div>
              )}
              {!isQuestionsLoading && !isQuestionsError && questions.length === 0 && (
                <div className="rounded-2xl border border-white/10 bg-[var(--surface)] p-4 text-sm text-[var(--text-soft)]">
                  No questions found for this filter.
                </div>
              )}
              {questions.map((question) => (
                <QuestionCard key={question.postId} question={question} />
              ))}
            </div>
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
