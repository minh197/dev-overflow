"use client";

import { useMutation } from "@tanstack/react-query";
import Link from "next/link";

import { AuthCard } from "@/components/auth/auth-card";
import { forgotPassword } from "@/lib/api/auth-api";

type CheckEmailPageProps = {
  email: string;
  resetUrl?: string;
};

export function CheckEmailPage({ email, resetUrl }: CheckEmailPageProps) {
  const resendMutation = useMutation({
    mutationFn: forgotPassword,
  });

  return (
    <AuthCard
      title="Check your email"
      subtitle={`We sent a password reset link to ${email || "your email address"}`}
    >
      <div className="space-y-6">
        <button
          type="button"
          disabled={!email || resendMutation.isPending}
          onClick={() => resendMutation.mutate({ email })}
          className="w-full rounded-2xl bg-[linear-gradient(90deg,#ff6a00,#ef9f62)] px-5 py-4 text-lg font-semibold text-white transition-opacity hover:opacity-95 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {resendMutation.isPending ? "Resending..." : "Resend"}
        </button>

        {resetUrl && (
          <div className="rounded-2xl border border-white/8 bg-[#171a24] px-4 py-4 text-sm text-[#c4c8d7]">
            Dev reset link:{" "}
            <a className="text-[#7db6ff]" href={resetUrl}>
              {resetUrl}
            </a>
          </div>
        )}

        <div className="text-center">
          <Link
            href="/sign-in"
            className="text-lg text-[#c4c8d7] transition-colors hover:text-white"
          >
            Back to login
          </Link>
        </div>
      </div>
    </AuthCard>
  );
}
