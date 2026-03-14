import { Suspense } from "react";

import { AccountLinkConflictPage } from "@/components/auth/account-link-conflict-page";

type AccountLinkRouteProps = {
  searchParams: Promise<{
    token?: string;
    email?: string;
    provider?: string;
  }>;
};

export default async function AccountLinkRoute({
  searchParams,
}: AccountLinkRouteProps) {
  const resolvedSearchParams = await searchParams;

  return (
    <Suspense fallback={null}>
      <AccountLinkConflictPage
        token={resolvedSearchParams.token ?? ""}
        email={resolvedSearchParams.email ?? ""}
        provider={resolvedSearchParams.provider ?? "social"}
      />
    </Suspense>
  );
}
