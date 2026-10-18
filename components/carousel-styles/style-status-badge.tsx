import { Badge } from "@/components/ui/badge";
import type { CarouselStyle } from "@/services/carousel-styles";

export function StyleStatusBadge({
  status,
  hasImages,
}: {
  status: CarouselStyle["analysis_status"];
  hasImages: boolean;
}) {
  if (status === "ready") return <Badge variant="positive">DNA pronto</Badge>;
  if (status === "analyzing") return <Badge variant="violet">Analisando</Badge>;
  if (status === "failed") return <Badge variant="destructive">Análise falhou</Badge>;
  return <Badge variant="secondary">{hasImages ? "Não analisado" : "Vazio"}</Badge>;
}
