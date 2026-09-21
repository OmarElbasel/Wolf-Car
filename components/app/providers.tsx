"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MotionConfig } from "motion/react";
import { Direction } from "radix-ui";
import { type ReactNode, useState } from "react";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ApiError } from "@/lib/api/client";

function makeQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 15_000,
        refetchOnWindowFocus: false,
        // client errors (auth, permission, not found, validation) won't fix themselves
        retry: (count, error) => !(error instanceof ApiError && error.status < 500) && count < 2,
      },
      mutations: { retry: false },
    },
  });
}

/** Client-side providers for the staff and showroom pages. */
export function AppProviders({ locale, children }: { locale: string; children: ReactNode }) {
  const [queryClient] = useState(makeQueryClient);
  const dir = locale === "ar" ? "rtl" : "ltr";
  return (
    <QueryClientProvider client={queryClient}>
      <Direction.Provider dir={dir}>
        <MotionConfig reducedMotion="user">
          <TooltipProvider delayDuration={300}>
            {children}
            <Toaster dir={dir} />
          </TooltipProvider>
        </MotionConfig>
      </Direction.Provider>
    </QueryClientProvider>
  );
}
