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

function validateUsername(value: string): string | null {
  const trimmed = value.trim();
  if (trimmed.length === 0) return "Username is required.";
  if (trimmed.length < 3) return "Username must be at least 3 characters.";
  if (trimmed.length > 32) return "Username cannot exceed 32 characters.";
  if (!/^[a-zA-Z0-9_]+$/.test(trimmed))
    return "Username can only contain letters, numbers, and underscores.";
  return null;
}

function validateEmail(value: string): string | null {
  const trimmed = value.trim();
  if (trimmed.length === 0) return "Email address is required.";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed))
    return "Please enter a valid email address.";
  return null;
}

function validatePassword(value: string): string | null {
  if (value.length === 0) return "Password is required.";
  if (value.length < 8) return "Password must be at least 8 characters.";
  if (value.length > 128) return "Password cannot exceed 128 characters.";
  return null;
}

export function SignUpPage({ nextPath }: SignUpPageProps) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [usernameError, setUsernameError] = useState<string | null>(null);
  const [emailError, setEmailError] = useState<string | null>(null);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [apiError, setApiError] = useState<string | null>(null);

  const signUpMutation = useMutation({
    mutationFn: signUp,
    onSuccess: async (result) => {
      setApiError(null);
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
      setApiError(
        getApiErrorMessage(error, "Unable to create your account right now."),
      );
    },
  });

  return (
    <AuthCard title="Create your account" subtitle="to continue to DevFlow">
      <form
        className="space-y-6"
        onSubmit={(event) => {
          event.preventDefault();
          const uErr = validateUsername(username);
          const eErr = validateEmail(email);
          const pErr = validatePassword(password);
          setUsernameError(uErr);
          setEmailError(eErr);
          setPasswordError(pErr);
          if (uErr ?? eErr ?? pErr) return;

          setApiError(null);
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
          error={usernameError ?? undefined}
          onChange={(value) => {
            setUsername(value);
            if (usernameError) setUsernameError(validateUsername(value));
          }}
          onBlur={() => setUsernameError(validateUsername(username))}
        />
        <AuthInput
          id="sign-up-email"
          type="email"
          label="Email address"
          value={email}
          error={emailError ?? undefined}
          onChange={(value) => {
            setEmail(value);
            if (emailError) setEmailError(validateEmail(value));
          }}
          onBlur={() => setEmailError(validateEmail(email))}
        />
        <AuthInput
          id="sign-up-password"
          type="password"
          label="Password"
          value={password}
          error={passwordError ?? undefined}
          onChange={(value) => {
            setPassword(value);
            if (passwordError) setPasswordError(validatePassword(value));
          }}
          onBlur={() => setPasswordError(validatePassword(password))}
        />

        {apiError && (
          <div className="rounded-2xl border border-red-400/20 bg-red-500/10 px-4 py-3 text-sm text-red-200">
            {apiError}
          </div>
        )}

        <button
          type="submit"
          disabled={signUpMutation.isPending}
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
