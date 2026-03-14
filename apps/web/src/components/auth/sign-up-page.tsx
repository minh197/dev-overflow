"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { AuthCard } from "@/components/auth/auth-card";
import { AuthInput } from "@/components/auth/auth-input";
import { SocialAuthButtons } from "@/components/auth/social-auth-buttons";
import { getApiErrorMessage } from "@/lib/api/api-errors";
import { signUp } from "@/lib/api/auth-api";

type SignUpPageProps = {
  nextPath: string;
};

export function SignUpPage({ nextPath }: SignUpPageProps) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const signUpMutation = useMutation({
    mutationFn: signUp,
    onSuccess: async (result) => {
      setErrorMessage(null);
      await queryClient.invalidateQueries({ queryKey: ["auth-me"] });
      const params = new URLSearchParams({
        signup: "success",
        email: result.user.email,
      });
      if (nextPath !== "/") {
        params.set("next", nextPath);
      }
      router.replace(`/sign-in?${params.toString()}`);
    },
    onError: (error) => {
      setErrorMessage(
        getApiErrorMessage(error, "Unable to create your account right now."),
      );
    },
  });

  const canSubmit =
    username.trim().length >= 3 &&
    email.trim().length > 0 &&
    password.trim().length >= 8;

  return (
    <AuthCard title="Create your account" subtitle="to continue to DevFlow">
      <form
        className="space-y-6"
        onSubmit={(event) => {
          event.preventDefault();
          if (!canSubmit) {
            setErrorMessage(
              "Username must be at least 3 characters and password at least 8.",
            );
            return;
          }

          signUpMutation.mutate({
            username: username.trim(),
            email: email.trim(),
            password,
          });
        }}
      >
        <AuthInput
          id="sign-up-username"
          label="Username"
          value={username}
          onChange={setUsername}
        />
        <AuthInput
          id="sign-up-email"
          type="email"
          label="Email address"
          value={email}
          onChange={setEmail}
        />
        <AuthInput
          id="sign-up-password"
          type="password"
          label="Password"
          value={password}
          onChange={setPassword}
        />

        {errorMessage && (
          <div className="rounded-2xl border border-red-400/20 bg-red-500/10 px-4 py-3 text-sm text-red-200">
            {errorMessage}
          </div>
        )}

        <button
          type="submit"
          disabled={!canSubmit || signUpMutation.isPending}
          className="w-full rounded-2xl bg-[linear-gradient(90deg,#ff6a00,#ef9f62)] px-5 py-4 text-lg font-semibold text-white transition-opacity hover:opacity-95 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {signUpMutation.isPending ? "Creating..." : "Continue"}
        </button>
      </form>

      <div className="mt-8 text-center text-lg text-[#c4c8d7]">
        Already have an account?{" "}
        <Link
          href={nextPath === "/" ? "/sign-in" : `/sign-in?next=${encodeURIComponent(nextPath)}`}
          className="font-semibold text-[#ff9a58]"
        >
          Sign in
        </Link>
      </div>

      <div className="mt-8">
        <SocialAuthButtons nextPath={nextPath} />
      </div>
    </AuthCard>
  );
}
