import { Surface } from "@/components/ui/surface";
import { studioFontById } from "@/lib/carousel-studio/fonts";
import type { StyleDna } from "@/lib/carousel-styles/dna";

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-1 gap-1 py-3 sm:grid-cols-[9rem_1fr] sm:gap-4">
      <dt className="text-xs font-semibold text-muted-foreground">{label}</dt>
      <dd className="text-sm leading-relaxed text-foreground/90">{children}</dd>
    </div>
  );
}

export function StyleDnaView({ dna }: { dna: StyleDna }) {
  const palette = dna.color.palette;
  return (
    <Surface padding="md">
      <p className="text-[0.9375rem] leading-relaxed font-medium">{dna.summary}</p>
      <dl className="mt-3 divide-y divide-border">
        <Row label="Layout">{dna.layoutGrammar}</Row>
        <Row label="Tipografia">
          <span className="font-semibold">
            {studioFontById(dna.typography.headingFont).label} + {studioFontById(dna.typography.bodyFont).label}
          </span>
          . {dna.typography.notes}
        </Row>
        <Row label="Cor">
          <span className="mb-2 flex gap-1.5">
            {(["dark", "light", "primary", "accent"] as const).map((role) => (
              <span
                key={role}
                title={`${role}: ${palette[role]}`}
                className="size-6 rounded-md ring-1 ring-border"
                style={{ background: palette[role] }}
              />
            ))}
          </span>
          {dna.color.usage}
        </Row>
        <Row label="Imagem">{dna.imageTreatment}</Row>
        {dna.recurringElements.length > 0 ? (
          <Row label="Elementos">
            <ul className="space-y-1">
              {dna.recurringElements.map((e) => (
                <li key={e.name}>
                  <span className="font-semibold">{e.name}:</span> {e.description}{" "}
                  <span className="text-muted-foreground">({e.placement})</span>
                </li>
              ))}
            </ul>
          </Row>
        ) : null}
        <Row label="Capa">{dna.pages.cover}</Row>
        <Row label="Miolo">{dna.pages.inner}</Row>
        <Row label="CTA">{dna.pages.cta}</Row>
        <Row label="Variação">{dna.variationRules}</Row>
        {dna.avoid.length > 0 ? <Row label="Evitar">{dna.avoid.join(" · ")}</Row> : null}
      </dl>
    </Surface>
  );
}
