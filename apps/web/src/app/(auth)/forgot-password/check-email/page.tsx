import { Suspense } from "react";

import { CheckEmailPage } from "@/components/auth/check-email-page";

type CheckEmailRouteProps = {
  searchParams: Promise<{
    email?: string;
    resetUrl?: string;
  }>;
};

export default async function ForgotPasswordCheckEmailPage({
  searchParams,
}: CheckEmailRouteProps) {
  const resolvedSearchParams = await searchParams;

  return (
    <Suspense fallback={null}>
      <CheckEmailPage
        email={resolvedSearchParams.email ?? ""}
        resetUrl={resolvedSearchParams.resetUrl}
      />
    </Suspense>
  );
}
