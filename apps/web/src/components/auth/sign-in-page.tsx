"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { AuthCard } from "@/components/auth/auth-card";
import { AuthInput } from "@/components/auth/auth-input";
import { SocialAuthButtons } from "@/components/auth/social-auth-buttons";
import { getApiErrorMessage } from "@/lib/api/api-errors";
import { signIn } from "@/lib/api/auth-api";

type SignInPageProps = {
  nextPath: string;
  initialEmail?: string;
  showSignupSuccess?: boolean;
};

export function SignInPage({
  nextPath,
  initialEmail = "",
  showSignupSuccess = false,
}: SignInPageProps) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [email, setEmail] = useState(initialEmail);
  const [password, setPassword] = useState("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const signInMutation = useMutation({
    mutationFn: signIn,
    onSuccess: async () => {
      setErrorMessage(null);
      await queryClient.invalidateQueries({ queryKey: ["auth-me"] });
      router.replace(nextPath);
    },
    onError: (error) => {
      setErrorMessage(
        getApiErrorMessage(error, "Unable to sign in. Please try again."),
      );
    },
  });

  const canSubmit = email.trim().length > 0 && password.trim().length >= 8;

  return (
    <AuthCard title="Sign in" subtitle="to continue to DevFlow">
      <form
        className="space-y-6"
        onSubmit={(event) => {
          event.preventDefault();
          if (!canSubmit) {
            setErrorMessage("Enter your email address and password to continue.");
            return;
          }
          signInMutation.mutate({
            email: email.trim(),
            password,
          });
        }}
      >
        {showSignupSuccess && (
          <div className="rounded-2xl border border-emerald-400/20 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-200">
            Account created successfully. Please sign in to continue.
          </div>
        )}

        <AuthInput
          id="sign-in-email"
          type="email"
          label="Email address"
          value={email}
          onChange={setEmail}
        />
        <div className="space-y-3">
          <AuthInput
            id="sign-in-password"
            type="password"
            label="Password"
            value={password}
            onChange={setPassword}
          />
          <div className="text-right">
            <Link
              href="/forgot-password"
              className="text-sm text-[#4a9cff] transition-colors hover:text-[#7db6ff]"
            >
              Forget password?
            </Link>
          </div>
        </div>

        {errorMessage && (
          <div className="rounded-2xl border border-red-400/20 bg-red-500/10 px-4 py-3 text-sm text-red-200">
            {errorMessage}
          </div>
        )}

        <button
          type="submit"
          disabled={!canSubmit || signInMutation.isPending}
          className="w-full rounded-2xl bg-[linear-gradient(90deg,#ff6a00,#ef9f62)] px-5 py-4 text-lg font-semibold text-white transition-opacity hover:opacity-95 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {signInMutation.isPending ? "Signing in..." : "Continue"}
        </button>
      </form>

      <div className="mt-8 text-center text-lg text-[#c4c8d7]">
        Don&apos;t have an account?{" "}
        <Link
          href={nextPath === "/" ? "/sign-up" : `/sign-up?next=${encodeURIComponent(nextPath)}`}
          className="font-semibold text-[#ff9a58]"
        >
          Sign up
        </Link>
      </div>

      <div className="mt-8">
        <SocialAuthButtons nextPath={nextPath} />
      </div>
    </AuthCard>
  );
}
