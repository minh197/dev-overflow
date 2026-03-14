"use client";

import { GitHubIcon, GoogleIcon } from "@/lib/icons";

type SocialAuthButtonsProps = {
  nextPath: string;
};

const providers = [
  { id: "github", label: "Login with GitHub", Icon: GitHubIcon },
  { id: "google", label: "Login with Google", Icon: GoogleIcon },
] as const;

export function SocialAuthButtons({ nextPath }: SocialAuthButtonsProps) {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {providers.map(({ id, label, Icon }) => (
        <a
          key={id}
          href={`${process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001"}/auth/${id}?next=${encodeURIComponent(nextPath)}`}
          className="inline-flex items-center justify-center gap-3 rounded-2xl border border-white/8 bg-[#1a1f2c] px-4 py-4 text-base font-medium text-[#d4d9ec] transition-colors hover:border-white/15 hover:bg-[#212736]"
        >
          <Icon className="h-5 w-5" />
          <span>{label}</span>
        </a>
      ))}
    </div>
  );
}
