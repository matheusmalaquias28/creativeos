"use client";

import { createContext, useContext, useMemo } from "react";
import { navSectionsFor, type NavSection } from "@/components/layout/nav-config";
import { canAccessPath, homePathFor, type AppRole } from "@/lib/auth/permissions";

type NavAccess = {
  role: AppRole;
  sections: NavSection[];
  homeHref: string;
  can: (path: string) => boolean;
};

const NavAccessContext = createContext<NavAccess | null>(null);

/** Disponibiliza a role do usuário para sidebar e command menu filtrarem a navegação. */
export function NavAccessProvider({ role, children }: { role: AppRole; children: React.ReactNode }) {
  const value = useMemo<NavAccess>(
    () => ({
      role,
      sections: navSectionsFor(role),
      homeHref: homePathFor(role),
      can: (path) => canAccessPath(role, path),
    }),
    [role]
  );
  return <NavAccessContext.Provider value={value}>{children}</NavAccessContext.Provider>;
}

export function useNavAccess(): NavAccess {
  const ctx = useContext(NavAccessContext);
  if (!ctx) throw new Error("useNavAccess precisa de <NavAccessProvider>");
  return ctx;
}
