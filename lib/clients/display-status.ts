import type { ClientStatus } from "@/types";
import { tones } from "@/lib/design/tokens";

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
    dotClass: tones.red.dot,
    badgeClass: tones.red.badge,
  },
  onboarding_incompleto: {
    label: "Onboarding incompleto",
    dotClass: tones.amber.dot,
    badgeClass: tones.amber.badge,
  },
  ativo: {
    label: "Ativo",
    dotClass: tones.green.dot,
    badgeClass: tones.green.badge,
  },
  desativado: {
    label: "Desativado",
    dotClass: tones.slate.dot,
    badgeClass: tones.slate.badge,
  },
};

export function getClientDisplayStatusConfig(status: ClientStatus) {
  return CLIENT_DISPLAY_STATUS_CONFIG[resolveClientDisplayStatus(status)];
}
