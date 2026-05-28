"use client";

import { Toaster } from "@/components/ui/sonner";
import { NavigationProgress } from "@/components/layout/navigation-progress";

export function AppProviders({ children }: { children: React.ReactNode }) {
  return (
    <>
      <NavigationProgress />
      {children}
      <Toaster position="top-right" closeButton duration={4000} />
    </>
  );
}
