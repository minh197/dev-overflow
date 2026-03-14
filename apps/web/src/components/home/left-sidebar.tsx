import type { NavItem } from "@/lib/homepage-types";
import { FlameIcon, LogOutIcon } from "@/lib/icons";
import Link from "next/link";

type LeftSidebarProps = {
  navItems: NavItem[];
};

export function LeftSidebar({ navItems }: LeftSidebarProps) {
  return (
    <aside className="sticky top-0 flex h-screen w-64 shrink-0 flex-col border-r border-white/10 bg-[var(--panel-bg)] px-4 py-5">
      <div className="mb-8 flex items-center gap-3 px-2">
        <span className="inline-flex h-9 w-9 items-center justify-center rounded-2xl bg-[var(--accent)]/15 text-[var(--accent)]">
          <FlameIcon className="h-5 w-5" />
        </span>
        <span className="text-base font-semibold tracking-tight text-[var(--text-strong)]">
          DevOverflow
        </span>
      </div>

      <nav className="space-y-1.5">
        {navItems.map((item) => (
          <Link
            key={item.id}
            href={item.href}
            className={`group flex items-center gap-3 rounded-2xl px-3 py-3 text-sm transition-all ${
              item.active
                ? "bg-[var(--accent)] font-semibold text-black shadow-[0_12px_30px_rgba(255,139,61,0.18)]"
                : "text-[var(--text-muted)] hover:bg-white/5 hover:text-[var(--text-strong)]"
            }`}
          >
            <item.icon
              className={`h-4 w-4 ${
                item.active
                  ? "text-black"
                  : "text-[var(--text-soft)] transition-colors group-hover:text-[var(--text-strong)]"
              }`}
            />
            <span>{item.label}</span>
          </Link>
        ))}
      </nav>

      <button
        type="button"
        className="mt-auto flex items-center gap-3 rounded-2xl border border-white/10 px-3 py-3 text-left text-sm text-[var(--text-muted)] transition-all hover:bg-white/5 hover:text-[var(--text-strong)]"
      >
        <LogOutIcon className="h-4 w-4 text-[var(--text-soft)]" />
        Logout
      </button>
    </aside>
  );
}
