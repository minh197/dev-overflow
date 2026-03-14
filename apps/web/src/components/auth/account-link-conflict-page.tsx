"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { AuthCard } from "@/components/auth/auth-card";
import { getApiErrorMessage } from "@/lib/api/api-errors";
import { resolveAccountLink } from "@/lib/api/auth-api";

type AccountLinkConflictPageProps = {
  token: string;
  email: string;
  provider: string;
};

export function AccountLinkConflictPage({
  token,
  email,
  provider,
}: AccountLinkConflictPageProps) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const linkMutation = useMutation({
    mutationFn: resolveAccountLink,
    onSuccess: async (result) => {
      setErrorMessage(null);
      await queryClient.invalidateQueries({ queryKey: ["auth-me"] });
      router.replace(result.nextPath || "/");
    },
    onError: (error) => {
      setErrorMessage(
        getApiErrorMessage(error, "Unable to link your accounts right now."),
      );
    },
  });

  return (
    <AuthCard
      title="Looks Like You Already Have an Account!"
      subtitle="We found an existing email login that matches your social sign-in."
    >
      <div className="space-y-6 text-lg leading-8 text-[#9aa3c4]">
        <p>
          It seems you&apos;ve previously created an account using{" "}
          <span className="font-medium text-white">{email || "email and password"}</span>.
        </p>
        <p>
          Would you like to link this account with your{" "}
          <span className="font-medium capitalize text-white">{provider}</span>{" "}
          login so you can keep everything in one place?
        </p>
        <p>
          Don&apos;t worry, your existing account will stay the same, and you can
          seamlessly access it using either method.
        </p>

        {errorMessage && (
          <div className="rounded-2xl border border-red-400/20 bg-red-500/10 px-4 py-3 text-sm text-red-200">
            {errorMessage}
          </div>
        )}

        <button
          type="button"
          disabled={!token || linkMutation.isPending}
          onClick={() => linkMutation.mutate(token)}
          className="w-full rounded-2xl bg-[linear-gradient(90deg,#ff6a00,#ef9f62)] px-5 py-4 text-lg font-semibold text-white transition-opacity hover:opacity-95 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {linkMutation.isPending ? "Linking..." : "Yes, Link My Accounts"}
        </button>

        <div className="text-center">
          <Link
            href={email ? `/sign-in?email=${encodeURIComponent(email)}` : "/sign-in"}
            className="text-lg text-[#d6daea] transition-colors hover:text-white"
          >
            No, I&apos;ll Keep Using Email Login
          </Link>
        </div>
      </div>
    </AuthCard>
  );
}
