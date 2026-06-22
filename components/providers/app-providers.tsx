"use client";

import { Toaster } from "@/components/ui/sonner";
import { NavigationProgress } from "@/components/layout/navigation-progress";
import { ThemeProvider } from "@/components/providers/theme-provider";

export function AppProviders({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider>
      <NavigationProgress />
      {children}
      <Toaster position="top-right" closeButton duration={4000} />
    </ThemeProvider>
  );
}
