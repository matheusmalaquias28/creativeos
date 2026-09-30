import { Check, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { ClientArtReadiness } from "@/services/reference-assets";

function Chip({ ok, label }: { ok: boolean; label: string }) {
  return (
    <Badge variant={ok ? "green" : "amber"} className="gap-1">
      {ok ? <Check className="size-3" /> : <X className="size-3" />}
      {label}
    </Badge>
  );
}

/**
 * O operador precisa ver o que falta ANTES de clicar, não descobrir num erro
 * depois. Cada chip é um requisito do kit.
 */
export function ReadinessChips({ readiness }: { readiness: ClientArtReadiness | null }) {
  if (!readiness) {
    return (
      <Badge variant="amber" className="gap-1">
        <X className="size-3" />
        Perfil criativo não cadastrado
      </Badge>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <Chip ok={readiness.has_logo} label="logo" />
      <Badge variant="outline">{readiness.has_dna ? "Identidade disponível" : "Sem identidade fixa"}</Badge>
      <Badge variant="outline">{readiness.reference_count} inspirações opcionais</Badge>
    </div>
  );
}
