import { Suspense } from "react";

import { ResetPasswordPage } from "@/components/auth/reset-password-page";

type ResetPasswordRouteProps = {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ next?: string }>;
};

export default async function ResetPasswordRoute({
  params,
  searchParams,
}: ResetPasswordRouteProps) {
  const [{ token }, resolvedSearchParams] = await Promise.all([params, searchParams]);

  return (
    <Suspense fallback={null}>
      <ResetPasswordPage token={token} nextPath={resolvedSearchParams.next ?? "/"} />
    </Suspense>
  );
}
