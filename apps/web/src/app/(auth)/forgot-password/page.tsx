"use client";

import { useMutation } from "@tanstack/react-query";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { AuthCard } from "@/components/auth/auth-card";
import { AuthInput } from "@/components/auth/auth-input";
import { forgotPassword } from "@/lib/api/auth-api";
import { getApiErrorMessage } from "@/lib/api/api-errors";

export default function ForgotPasswordPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const forgotPasswordMutation = useMutation({
    mutationFn: forgotPassword,
    onSuccess: (result) => {
      const query = new URLSearchParams({ email: result.email });
      if (result.resetUrl) {
        query.set("resetUrl", result.resetUrl);
      }
      router.push(`/forgot-password/check-email?${query.toString()}`);
    },
    onError: (error) => {
      setErrorMessage(
        getApiErrorMessage(error, "Unable to send reset instructions right now."),
      );
    },
  });

  const canSubmit = email.trim().length > 0;

  return (
    <AuthCard
      title="Forgot password?"
      subtitle="No worries, we’ll send you reset instructions."
    >
      <form
        className="space-y-6"
        onSubmit={(event) => {
          event.preventDefault();
          if (!canSubmit) {
            setErrorMessage("Enter the email address tied to your account.");
            return;
          }

          forgotPasswordMutation.mutate({ email: email.trim() });
        }}
      >
        <AuthInput
          id="forgot-password-email"
          type="email"
          label="Email address"
          value={email}
          onChange={setEmail}
        />

        {errorMessage && (
          <div className="rounded-2xl border border-red-400/20 bg-red-500/10 px-4 py-3 text-sm text-red-200">
            {errorMessage}
          </div>
        )}

        <button
          type="submit"
          disabled={!canSubmit || forgotPasswordMutation.isPending}
          className="w-full rounded-2xl bg-[linear-gradient(90deg,#ff6a00,#ef9f62)] px-5 py-4 text-lg font-semibold text-white transition-opacity hover:opacity-95 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {forgotPasswordMutation.isPending ? "Sending..." : "Continue"}
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
