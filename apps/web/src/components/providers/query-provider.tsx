"use client";

import {
  QueryClient,
  QueryClientProvider,
  useQueryClient,
} from "@tanstack/react-query";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";

type QueryProviderProps = {
  children: React.ReactNode;
};

function AuthStateRefresh() {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();

  useEffect(() => {
    const oauthProvider = searchParams.get("oauth");
    const linkedProvider = searchParams.get("linked");
    if (!oauthProvider && !linkedProvider) {
      return;
    }

    const nextSearchParams = new URLSearchParams(searchParams.toString());
    nextSearchParams.delete("oauth");
    nextSearchParams.delete("linked");

    void (async () => {
      await queryClient.invalidateQueries({ queryKey: ["auth-me"] });
      await queryClient.refetchQueries({
        queryKey: ["auth-me"],
        type: "active",
      });

      const nextQuery = nextSearchParams.toString();
      router.replace(nextQuery ? `${pathname}?${nextQuery}` : pathname, {
        scroll: false,
      });
    })();
  }, [pathname, queryClient, router, searchParams]);

  return null;
}

export function QueryProvider({ children }: QueryProviderProps) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 30_000,
            retry: 1,
            refetchOnWindowFocus: false,
          },
        },
      }),
  );

  return (
    <QueryClientProvider client={queryClient}>
      <AuthStateRefresh />
      {children}
    </QueryClientProvider>
  );
}
