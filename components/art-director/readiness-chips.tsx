import { Check, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { ClientArtReadiness } from "@/services/reference-assets";

function Chip({ ok, label }: { ok: boolean; label: string }) {
  return (
    <Badge variant={ok ? "positive" : "outline"} className="gap-1">
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
    return <Badge variant="outline">Perfil criativo não cadastrado</Badge>;
  }

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <Chip ok={readiness.has_logo} label="logo" />
      <Chip ok={readiness.has_palette} label="paleta" />
      <Chip ok={readiness.has_dna} label="DNA visual" />
      <Chip
        ok={readiness.reference_count >= 4 && readiness.style_reference_count >= 1}
        label={`${readiness.reference_count} referências`}
      />
    </div>
  );
}
