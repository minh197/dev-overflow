import type { ReactNode } from "react";

import { FlameIcon } from "@/lib/icons";

type AuthCardProps = {
  title: string;
  subtitle: string;
  children: ReactNode;
};

export function AuthCard({ title, subtitle, children }: AuthCardProps) {
  return (
    <section className="w-full max-w-[530px] rounded-[28px] border border-white/8 bg-[#11131b]/95 p-8 shadow-[0_30px_120px_rgba(0,0,0,0.55)] backdrop-blur">
      <div className="mb-8 flex items-start justify-between gap-6">
        <div>
          <h1 className="text-4xl font-semibold tracking-tight text-white">{title}</h1>
          <p className="mt-2 text-lg text-[#8f96b4]">{subtitle}</p>
        </div>
        <span className="inline-flex h-14 w-14 items-center justify-center rounded-full bg-[var(--accent)]/12 text-[var(--accent)]">
          <FlameIcon className="h-8 w-8" />
        </span>
      </div>
      {children}
    </section>
  );
}
