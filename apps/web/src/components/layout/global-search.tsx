"use client";

import { useQuery } from "@tanstack/react-query";
import {
  FileQuestionIcon,
  MessageSquareQuoteIcon,
  MoonStarIcon,
  SearchIcon,
  TagIcon,
  UsersIcon,
} from "@/lib/icons";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";

import { fetchGlobalSearch } from "@/lib/api/homepage-api";
import type {
  GlobalSearchAnswerResult,
  GlobalSearchQuestionResult,
  GlobalSearchResponse,
  GlobalSearchSection,
  GlobalSearchTagResult,
  GlobalSearchUserResult,
} from "@/lib/homepage-types";

type GlobalSearchProps = {
  placeholder?: string;
  userInitials?: string;
};

type SearchChip = {
  id: GlobalSearchSection;
  label: string;
};

type SearchItem =
  | ({ section: "questions" } & GlobalSearchQuestionResult)
  | ({ section: "answers" } & GlobalSearchAnswerResult)
  | ({ section: "users" } & GlobalSearchUserResult)
  | ({ section: "tags" } & GlobalSearchTagResult);

const searchChips: SearchChip[] = [
  { id: "questions", label: "Question" },
  { id: "answers", label: "Answer" },
  { id: "users", label: "Users" },
  { id: "tags", label: "Tags" },
];

function isSearchSection(value: string | null): value is GlobalSearchSection {
  return (
    value === "questions" ||
    value === "answers" ||
    value === "users" ||
    value === "tags"
  );
}

function useDebouncedValue(value: string, delayMs: number) {
  const [debouncedValue, setDebouncedValue] = useState(value);

  useEffect(() => {
    const timeout = window.setTimeout(() => setDebouncedValue(value), delayMs);
    return () => window.clearTimeout(timeout);
  }, [delayMs, value]);

  return debouncedValue;
}

function getFirstAvailableSection(
  results: GlobalSearchResponse | undefined,
): GlobalSearchSection {
  if (!results) return "questions";
  if (results.questions.length > 0) return "questions";
  if (results.answers.length > 0) return "answers";
  if (results.users.length > 0) return "users";
  if (results.tags.length > 0) return "tags";
  return "questions";
}

function getItemsForSection(
  results: GlobalSearchResponse | undefined,
  section: GlobalSearchSection,
): SearchItem[] {
  if (!results) return [];

  switch (section) {
    case "questions":
      return results.questions.map((item) => ({ ...item, section }));
    case "answers":
      return results.answers.map((item) => ({ ...item, section }));
    case "users":
      return results.users.map((item) => ({ ...item, section }));
    case "tags":
      return results.tags.map((item) => ({ ...item, section }));
    default:
      return [];
  }
}

export function GlobalSearch({
  placeholder = "Search anything globally",
  userInitials = "JS",
}: GlobalSearchProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const containerRef = useRef<HTMLDivElement>(null);
  const queryParam = searchParams.get("search") ?? "";
  const typeParam = searchParams.get("type");

  const [query, setQuery] = useState(queryParam);
  const [activeSection, setActiveSection] = useState<GlobalSearchSection>(
    isSearchSection(typeParam) ? typeParam : "questions",
  );
  const [isOpen, setIsOpen] = useState(Boolean(queryParam.trim()));
  const [activeIndex, setActiveIndex] = useState(0);
  const debouncedQuery = useDebouncedValue(query, 250);

  useEffect(() => {
    function handleOutsidePointer(event: MouseEvent) {
      if (!containerRef.current?.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    document.addEventListener("mousedown", handleOutsidePointer);
    return () => document.removeEventListener("mousedown", handleOutsidePointer);
  }, []);

  const { data, isFetching } = useQuery({
    queryKey: ["global-search", debouncedQuery],
    queryFn: () => fetchGlobalSearch(debouncedQuery),
    enabled: debouncedQuery.trim().length >= 2,
    staleTime: 30_000,
  });

  const displaySection = useMemo(() => {
    if (!data) return activeSection;

    const sectionItems = getItemsForSection(data, activeSection);
    if (sectionItems.length > 0) {
      return activeSection;
    }

    return getFirstAvailableSection(data);
  }, [activeSection, data]);

  const visibleItems = useMemo(
    () => getItemsForSection(data, displaySection),
    [data, displaySection],
  );

  const hasQuery = query.trim().length >= 2;
  const shouldShowDropdown = isOpen && hasQuery;

  function openSection(section: GlobalSearchSection) {
    setActiveSection(section);
    setActiveIndex(0);
    setIsOpen(true);
  }

  function handleSelect(item: SearchItem) {
    if (item.section === "users") {
      setQuery(item.username);
      setActiveSection("users");
    }

    if (item.section === "tags") {
      setQuery(item.slug);
      setActiveSection("tags");
    }

    setIsOpen(false);
    router.push(item.href);
  }

  function handleKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (!shouldShowDropdown || visibleItems.length === 0) {
      if (event.key === "Enter" && hasQuery) {
        setIsOpen(true);
      }
      return;
    }

    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActiveIndex((index) => (index + 1) % visibleItems.length);
      return;
    }

    if (event.key === "ArrowUp") {
      event.preventDefault();
      setActiveIndex(
        (index) => (index - 1 + visibleItems.length) % visibleItems.length,
      );
      return;
    }

    if (event.key === "Enter") {
      event.preventDefault();
      handleSelect(visibleItems[activeIndex] ?? visibleItems[0]);
      return;
    }

    if (event.key === "Escape") {
      event.preventDefault();
      setIsOpen(false);
    }
  }

  function renderResult(item: SearchItem, index: number) {
    const isActive = index === activeIndex;
    const baseClassName = `w-full rounded-2xl border px-3 py-3 text-left transition-colors ${
      isActive
        ? "border-[var(--accent)]/40 bg-[var(--accent)]/10"
        : "border-transparent hover:border-white/10 hover:bg-white/5"
    }`;

    if (item.section === "questions") {
      return (
        <button
          key={`${item.section}-${item.id}`}
          type="button"
          onMouseEnter={() => setActiveIndex(index)}
          onClick={() => handleSelect(item)}
          className={baseClassName}
        >
          <div className="mb-1 flex items-center gap-2 text-[10px] uppercase tracking-[0.18em] text-[var(--text-subtle)]">
            <FileQuestionIcon className="h-3.5 w-3.5" />
            {index === 0 ? "Top Match" : "Question"}
          </div>
          <div className="text-sm font-semibold text-[var(--text-strong)]">
            {item.title}
          </div>
          <div className="mt-1 text-xs text-[var(--text-soft)]">
            {item.authorName} · {item.createdAtLabel}
          </div>
          {item.tags.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-2">
              {item.tags.map((tagName) => (
                <span
                  key={tagName}
                  className="rounded-full bg-[var(--chip-bg)] px-2 py-1 text-[10px] text-[var(--text-soft)]"
                >
                  {tagName}
                </span>
              ))}
            </div>
          )}
        </button>
      );
    }

    if (item.section === "answers") {
      return (
        <button
          key={`${item.section}-${item.id}`}
          type="button"
          onMouseEnter={() => setActiveIndex(index)}
          onClick={() => handleSelect(item)}
          className={baseClassName}
        >
          <div className="mb-1 flex items-center gap-2 text-[10px] uppercase tracking-[0.18em] text-[var(--text-subtle)]">
            <MessageSquareQuoteIcon className="h-3.5 w-3.5" />
            {index === 0 ? "Top Match" : "Answer"}
          </div>
          <div className="line-clamp-2 text-sm font-semibold text-[var(--text-strong)]">
            {item.excerpt}
          </div>
          <div className="mt-1 text-xs text-[var(--text-soft)]">
            In {item.questionTitle}
          </div>
          <div className="mt-1 text-xs text-[var(--text-subtle)]">
            {item.authorName} · {item.createdAtLabel}
          </div>
        </button>
      );
    }

    if (item.section === "users") {
      return (
        <button
          key={`${item.section}-${item.id}`}
          type="button"
          onMouseEnter={() => setActiveIndex(index)}
          onClick={() => handleSelect(item)}
          className={baseClassName}
        >
          <div className="mb-1 flex items-center gap-2 text-[10px] uppercase tracking-[0.18em] text-[var(--text-subtle)]">
            <UsersIcon className="h-3.5 w-3.5" />
            {index === 0 ? "Top Match" : "User"}
          </div>
          <div className="text-sm font-semibold text-[var(--text-strong)]">
            {item.displayName}
          </div>
          <div className="mt-1 text-xs text-[var(--text-soft)]">
            @{item.username}
          </div>
          <div className="mt-1 text-xs text-[var(--text-subtle)]">
            {item.reputationLabel}
          </div>
        </button>
      );
    }

    return (
      <button
        key={`${item.section}-${item.id}`}
        type="button"
        onMouseEnter={() => setActiveIndex(index)}
        onClick={() => handleSelect(item)}
        className={baseClassName}
      >
        <div className="mb-1 flex items-center gap-2 text-[10px] uppercase tracking-[0.18em] text-[var(--text-subtle)]">
          <TagIcon className="h-3.5 w-3.5" />
          {index === 0 ? "Top Match" : "Tag"}
        </div>
        <div className="text-sm font-semibold text-[var(--text-strong)]">
          {item.displayName}
        </div>
        <div className="mt-1 text-xs text-[var(--text-soft)]">#{item.slug}</div>
        <div className="mt-1 text-xs text-[var(--text-subtle)]">
          {item.countLabel}
        </div>
      </button>
    );
  }

  return (
    <div ref={containerRef} className="relative mb-6">
      <header className="flex items-center gap-3">
        <label
          htmlFor="global-search"
          className="flex h-12 flex-1 items-center rounded-2xl border border-white/10 bg-[var(--surface-muted)] px-4 focus-within:border-[var(--accent)]/60"
        >
          <SearchIcon className="mr-3 h-4 w-4 text-[var(--text-soft)]" />
          <input
            id="global-search"
            type="text"
            value={query}
            placeholder={placeholder}
            onFocus={() => setIsOpen(hasQuery)}
            onChange={(event) => {
              const nextValue = event.target.value;
              setQuery(nextValue);
              setIsOpen(nextValue.trim().length >= 2);
              setActiveIndex(0);
            }}
            onKeyDown={handleKeyDown}
            className="w-full bg-transparent text-sm text-[var(--text-strong)] placeholder:text-[var(--text-soft)] focus:outline-none"
          />
        </label>

        <button
          type="button"
          aria-label="Toggle theme"
          className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-[var(--surface)] text-[var(--text-muted)]"
        >
          <MoonStarIcon className="h-4 w-4" />
        </button>
        <button
          type="button"
          aria-label="User profile"
          className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-sky-100 text-xs font-semibold text-sky-700"
        >
          {userInitials}
        </button>
      </header>

      {shouldShowDropdown && (
        <div className="absolute left-0 top-[calc(100%+12px)] z-30 w-full max-w-[680px] rounded-[24px] border border-white/10 bg-[var(--panel-bg)] p-4 shadow-[0_24px_80px_rgba(0,0,0,0.45)] backdrop-blur">
          <div className="mb-4 flex flex-wrap items-center gap-2">
            <span className="text-sm font-medium text-[var(--text-muted)]">
              Type:
            </span>
            {searchChips.map((chip) => {
              const count = data ? data[chip.id].length : 0;
              const isActive = chip.id === displaySection;
              return (
                <button
                  key={chip.id}
                  type="button"
                  onClick={() => openSection(chip.id)}
                  className={`rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
                    isActive
                      ? "bg-[var(--accent)] text-black"
                      : "bg-[var(--surface)] text-[var(--text-soft)] hover:bg-white/10 hover:text-[var(--text-strong)]"
                  }`}
                >
                  {chip.label} {count > 0 ? `(${count})` : ""}
                </button>
              );
            })}
          </div>

          <div className="max-h-[420px] space-y-2 overflow-y-auto pr-1">
            {isFetching && (
              <div className="rounded-2xl border border-white/10 bg-[var(--surface)] px-4 py-6 text-sm text-[var(--text-soft)]">
                Searching...
              </div>
            )}

            {!isFetching && visibleItems.length === 0 && (
              <div className="rounded-2xl border border-white/10 bg-[var(--surface)] px-4 py-6 text-sm text-[var(--text-soft)]">
                No matches found for this type.
              </div>
            )}

            {!isFetching &&
              visibleItems.map((item, index) => renderResult(item, index))}
          </div>

          <div className="mt-4 flex items-center justify-between text-xs text-[var(--text-subtle)]">
            <span>
              {pathname === "/"
                ? "Homepage search is live"
                : "Search stays shared across pages"}
            </span>
            <span>Use ↑ ↓ to navigate</span>
          </div>
        </div>
      )}

      {query.trim().length > 0 && query.trim().length < 2 && (
        <div className="absolute left-0 top-[calc(100%+12px)] z-20 rounded-2xl border border-white/10 bg-[var(--panel-bg)] px-4 py-3 text-xs text-[var(--text-soft)]">
          Type at least 2 characters to search globally.
        </div>
      )}
    </div>
  );
}
