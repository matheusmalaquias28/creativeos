import type { ClientStatus } from "@/types";

export type ClientDisplayStatus =
  | "onboarding_pendente"
  | "onboarding_incompleto"
  | "ativo"
  | "desativado";

export function resolveClientDisplayStatus(
  status: ClientStatus
): ClientDisplayStatus {
  if (status === "archived") return "desativado";
  if (status === "active") return "ativo";
  if (status === "draft") return "onboarding_pendente";
  return "onboarding_incompleto";
}

export const CLIENT_DISPLAY_STATUS_CONFIG: Record<
  ClientDisplayStatus,
  { label: string; dotClass: string; badgeClass: string }
> = {
  onboarding_pendente: {
    label: "Onboarding pendente",
    dotClass: "bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.45)]",
    badgeClass:
      "border-red-500/40 bg-red-500/10 text-red-700 dark:text-red-400",
  },
  onboarding_incompleto: {
    label: "Onboarding incompleto",
    dotClass: "bg-amber-400 shadow-[0_0_8px_rgba(251,191,36,0.45)]",
    badgeClass:
      "border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-400",
  },
  ativo: {
    label: "Ativo",
    dotClass: "bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.45)]",
    badgeClass:
      "border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400",
  },
  desativado: {
    label: "Desativado",
    dotClass: "bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.45)]",
    badgeClass:
      "border-red-500/40 bg-red-500/10 text-red-700 dark:text-red-400",
  },
};

export function getClientDisplayStatusConfig(status: ClientStatus) {
  return CLIENT_DISPLAY_STATUS_CONFIG[resolveClientDisplayStatus(status)];
}
