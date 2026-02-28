import type { NavItem } from "@/lib/homepage-types";

type LeftSidebarProps = {
  navItems: NavItem[];
};

export function LeftSidebar({ navItems }: LeftSidebarProps) {
  return (
    <aside className="flex h-screen w-64 flex-col border-r border-white/10 bg-[var(--panel-bg)] px-4 py-5">
      <div className="mb-8 flex items-center gap-2">
        <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-[var(--accent)] text-xs font-bold text-black">
          D
        </span>
        <span className="text-base font-semibold text-[var(--text-strong)]">
          DevOverflow
        </span>
      </div>

      <nav className="space-y-1">
        {navItems.map((item) => (
          <a
            key={item.id}
            href={item.href}
            className={`flex items-center rounded-xl px-3 py-2 text-sm transition-colors ${
              item.active
                ? "bg-[var(--accent)] font-medium text-black"
                : "text-[var(--text-muted)] hover:bg-white/5 hover:text-[var(--text-strong)]"
            }`}
          >
            <span className="mr-2 text-xs">◦</span>
            {item.label}
          </a>
        ))}
      </nav>

      <button
        type="button"
        className="mt-auto rounded-xl border border-white/10 px-3 py-2 text-left text-sm text-[var(--text-muted)] transition-colors hover:bg-white/5 hover:text-[var(--text-strong)]"
      >
        Logout
      </button>
    </aside>
  );
}
