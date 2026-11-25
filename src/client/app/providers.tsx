import { QueryClientProvider, type QueryClient } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { TooltipProvider } from "@/components/ui/tooltip";
import { SessionGuard } from "@/features/session/session-guard";
import { ThemeProvider } from "@/features/theme/theme-provider";
import { UiStateProvider } from "./ui-state";

export function Providers({ queryClient, children }: { queryClient: QueryClient; children: ReactNode }) {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <TooltipProvider>
          <UiStateProvider>
            <SessionGuard>{children}</SessionGuard>
          </UiStateProvider>
        </TooltipProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}
