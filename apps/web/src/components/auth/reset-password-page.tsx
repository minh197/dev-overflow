"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { AuthCard } from "@/components/auth/auth-card";
import { AuthInput } from "@/components/auth/auth-input";
import { getApiErrorMessage } from "@/lib/api/api-errors";
import { resetPassword } from "@/lib/api/auth-api";

type ResetPasswordPageProps = {
  token: string;
  nextPath: string;
};

export function ResetPasswordPage({
  token,
  nextPath,
}: ResetPasswordPageProps) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const resetPasswordMutation = useMutation({
    mutationFn: resetPassword,
    onSuccess: async () => {
      setErrorMessage(null);
      await queryClient.invalidateQueries({ queryKey: ["auth-me"] });
      router.replace(nextPath);
    },
    onError: (error) => {
      setErrorMessage(
        getApiErrorMessage(error, "Unable to reset your password right now."),
      );
    },
  });

  const canSubmit =
    password.trim().length >= 8 && confirmPassword.trim().length >= 8;

  return (
    <AuthCard title="Set new password" subtitle="New password must be different">
      <form
        className="space-y-6"
        onSubmit={(event) => {
          event.preventDefault();

          if (!canSubmit) {
            setErrorMessage("Choose a password that is at least 8 characters long.");
            return;
          }

          if (password !== confirmPassword) {
            setErrorMessage("Password confirmation does not match.");
            return;
          }

          resetPasswordMutation.mutate({
            token,
            password,
            confirmPassword,
          });
        }}
      >
        <AuthInput
          id="reset-password"
          type="password"
          label="Password"
          value={password}
          onChange={setPassword}
        />
        <AuthInput
          id="reset-password-confirm"
          type="password"
          label="Confirm password"
          value={confirmPassword}
          onChange={setConfirmPassword}
        />

        {errorMessage && (
          <div className="rounded-2xl border border-red-400/20 bg-red-500/10 px-4 py-3 text-sm text-red-200">
            {errorMessage}
          </div>
        )}

        <button
          type="submit"
          disabled={!canSubmit || resetPasswordMutation.isPending}
          className="w-full rounded-2xl bg-[linear-gradient(90deg,#ff6a00,#ef9f62)] px-5 py-4 text-lg font-semibold text-white transition-opacity hover:opacity-95 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {resetPasswordMutation.isPending ? "Resetting..." : "Reset password"}
        </button>
      </form>

      <div className="mt-8 text-center">
        <Link
          href="/sign-in"
          className="text-lg text-[#c4c8d7] transition-colors hover:text-white"
        >
          Back to login
        </Link>
      </div>
    </AuthCard>
  );
}
