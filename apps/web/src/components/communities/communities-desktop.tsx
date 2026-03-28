"use client";

import { useQuery } from "@tanstack/react-query";
import Image from "next/image";
import { useEffect, useRef, useState } from "react";

import { AppShell } from "@/components/layout/app-shell";
import {
  ChevronDownIcon,
  ListFilterIcon,
  SearchIcon,
} from "@/lib/icons";
import { getInitials } from "@/lib/navigation";
import {
  fetchUsersDirectory,
  type UserDirectorySort,
  type UserListItem,
} from "@/lib/api/users-api";

const SORT_OPTIONS: { value: UserDirectorySort; label: string }[] = [
  { value: "popular", label: "Popular" },
  { value: "reputation", label: "Highest Reputation" },
  { value: "moderators", label: "Moderators" },
];

const sortToolbarLabels: Record<UserDirectorySort, string> = {
  popular: "Popular",
  reputation: "Highest Reputation",
  moderators: "Moderators",
};

function UserCard({ user }: { user: UserListItem }) {
  const displayName = user.fullName?.trim() || user.username;
  const initials = getInitials(displayName);

  return (
    <article className="flex flex-col items-center rounded-2xl border border-white/10 bg-[var(--surface)] px-4 py-6 text-center shadow-sm">
      <div className="mb-4 flex h-24 w-24 items-center justify-center overflow-hidden rounded-full bg-white/10 text-lg font-semibold text-[var(--text-strong)]">
        {user.avatarUrl ? (
          <Image
            src={user.avatarUrl}
            alt=""
            width={96}
            height={96}
            className="h-full w-full object-cover"
            unoptimized
          />
        ) : (
          initials
        )}
      </div>
      <h2 className="text-base font-semibold text-[var(--text-strong)]">
        {displayName}
      </h2>
      <p className="mt-1 text-sm text-[var(--text-muted)]">
        @{user.username}
      </p>
    </article>
  );
}

function SortDropdown({
  value,
  onChange,
}: {
  value: UserDirectorySort;
  onChange: (next: UserDirectorySort) => void;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [open]);

  return (
    <div className="relative shrink-0" ref={rootRef}>
      <button
        type="button"
        aria-expanded={open}
        aria-haspopup="listbox"
        onClick={() => setOpen((o) => !o)}
        className="flex h-11 min-w-[12rem] items-center gap-2 rounded-xl border border-white/10 bg-[var(--surface)] px-3 text-sm text-[var(--text-strong)] transition-colors hover:border-white/20"
      >
        <ListFilterIcon className="h-4 w-4 shrink-0 text-[var(--text-muted)]" />
        <span className="min-w-0 flex-1 truncate text-left">
          {sortToolbarLabels[value]}
        </span>
        <ChevronDownIcon
          className={`h-4 w-4 shrink-0 text-[var(--text-muted)] transition-transform ${open ? "rotate-180" : ""}`}
        />
      </button>
      {open && (
        <ul
          className="absolute right-0 z-20 mt-1 min-w-full rounded-xl border border-white/10 bg-[var(--surface)] py-1 shadow-lg"
          role="listbox"
        >
          {SORT_OPTIONS.map((opt) => {
            const active = opt.value === value;
            return (
              <li key={opt.value} role="none">
                <button
                  type="button"
                  role="option"
                  aria-selected={active}
                  onClick={() => {
                    onChange(opt.value);
                    setOpen(false);
                  }}
                  className={`flex w-full items-center px-3 py-2.5 text-left text-sm transition-colors ${
                    active
                      ? "bg-[var(--accent)] font-medium text-black"
                      : "text-[var(--text-soft)] hover:bg-white/5 hover:text-[var(--text-strong)]"
                  }`}
                >
                  {opt.label}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

export function CommunitiesDesktop() {
  const [sort, setSort] = useState<UserDirectorySort>("reputation");
  const [searchInput, setSearchInput] = useState("");
  const [debouncedQ, setDebouncedQ] = useState("");

  useEffect(() => {
    const t = window.setTimeout(() => setDebouncedQ(searchInput.trim()), 300);
    return () => window.clearTimeout(t);
  }, [searchInput]);

  const {
    data,
    isLoading,
    isError,
  } = useQuery({
    queryKey: ["users-directory", sort, debouncedQ],
    queryFn: () =>
      fetchUsersDirectory({
        sort,
        q: debouncedQ.length > 0 ? debouncedQ : undefined,
      }),
  });

  const users = data?.users ?? [];

  return (
    <AppShell activeNavId="communities">
      <h1 className="mb-6 text-3xl font-semibold text-[var(--text-strong)]">
        All Users
      </h1>

      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-3">
        <label className="relative min-w-0 flex-1">
          <span className="sr-only">Search by username</span>
          <SearchIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--text-muted)]" />
          <input
            type="search"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="Search by username..."
            className="h-11 w-full rounded-xl border border-white/10 bg-[var(--surface)] py-2 pl-10 pr-3 text-sm text-[var(--text-strong)] placeholder:text-[var(--text-muted)] outline-none transition-colors focus:border-[var(--accent)]/50"
            autoComplete="off"
          />
        </label>
        <SortDropdown value={sort} onChange={setSort} />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
        {isLoading && (
          <div className="col-span-full rounded-2xl border border-white/10 bg-[var(--surface)] p-4 text-sm text-[var(--text-soft)]">
            Loading users...
          </div>
        )}
        {isError && (
          <div className="col-span-full rounded-2xl border border-red-400/20 bg-red-500/10 p-4 text-sm text-red-200">
            Failed to load users. Please refresh and try again.
          </div>
        )}
        {!isLoading && !isError && users.length === 0 && (
          <div className="col-span-full rounded-2xl border border-white/10 bg-[var(--surface)] p-4 text-sm text-[var(--text-soft)]">
            No users match your search.
          </div>
        )}
        {!isLoading &&
          !isError &&
          users.map((user) => <UserCard key={user.id} user={user} />)}
      </div>
    </AppShell>
  );
}
