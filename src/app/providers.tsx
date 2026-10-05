"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState, type PropsWithChildren } from "react";
import { SiteLanguageProvider } from "@/core/i18n/provider";

export function Providers({ children }: PropsWithChildren) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            refetchOnWindowFocus: false,
            retry: 1,
            staleTime: 30_000,
          },
        },
      }),
  );

  return (
    <SiteLanguageProvider>
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    </SiteLanguageProvider>
  );
}
