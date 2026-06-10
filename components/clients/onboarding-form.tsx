"use client";

import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import {
  completeOnboardingAction,
  saveOnboardingDraft,
  type OnboardingActionState,
} from "@/actions/onboarding";
import { onboardingSchema, type OnboardingFormValues } from "@/lib/schemas/client";
import type { ClientPhotoRow } from "@/services/client-photos";
import { splitFontStyles } from "@/lib/utils/font-styles";
import { BrandColorPicker } from "@/components/clients/brand-color-picker";
import { FontStyleSelector } from "@/components/clients/font-style-selector";
import { LogoUploadField } from "@/components/clients/logo-upload-field";
import { ClientPhotosField } from "@/components/clients/client-photos-field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";

type OnboardingFormProps = {
  clientId: string;
  defaultValues: Partial<OnboardingFormValues> & { clientPhotos?: ClientPhotoRow[] };
  completedAt: string | null;
};

const briefingFields: {
  name: keyof OnboardingFormValues;
  label: string;
  placeholder: string;
  rows?: number;
}[] = [
  {
    name: "businessDescription",
    label: "Descrição do negócio",
    placeholder: "O que a marca faz, posicionamento, diferenciais...",
    rows: 4,
  },
  {
    name: "targetAudience",
    label: "Público-alvo",
    placeholder: "Quem são os clientes ideais?",
    rows: 3,
  },
  {
    name: "brandPersonality",
    label: "Personalidade da marca",
    placeholder: "Como a marca se comporta e se comunica?",
    rows: 2,
  },
  {
    name: "toneOfVoice",
    label: "Tom de voz",
    placeholder: "Formal, ousado, acolhedor...",
    rows: 2,
  },
  {
    name: "goals",
    label: "Objetivos da campanha",
    placeholder: "Conversão, awareness, lançamento...",
    rows: 3,
  },
  {
    name: "competitors",
    label: "Concorrentes",
    placeholder: "Principais referências do mercado",
    rows: 2,
  },
  {
    name: "visualInspirations",
    label: "Inspirações visuais",
    placeholder: "Estéticas, marcas ou referências",
    rows: 2,
  },
  {
    name: "avoidStyles",
    label: "Estilos a evitar",
    placeholder: "O que não deve aparecer nos criativos",
    rows: 2,
  },
];

function YesNoToggle({
  value,
  onChange,
}: {
  value: boolean | null | undefined;
  onChange: (v: boolean | null) => void;
}) {
  return (
    <div className="flex gap-2">
      <button
        type="button"
        onClick={() => onChange(value === true ? null : true)}
        className={cn(
          "rounded-lg border px-5 py-2 text-sm font-medium transition-premium",
          value === true
            ? "border-emerald-500/60 bg-emerald-500/15 text-emerald-600 dark:text-emerald-400"
            : "border-border bg-card text-muted-foreground hover:border-border/80 hover:text-foreground"
        )}
      >
        Sim
      </button>
      <button
        type="button"
        onClick={() => onChange(value === false ? null : false)}
        className={cn(
          "rounded-lg border px-5 py-2 text-sm font-medium transition-premium",
          value === false
            ? "border-rose-500/60 bg-rose-500/15 text-rose-600 dark:text-rose-400"
            : "border-border bg-card text-muted-foreground hover:border-border/80 hover:text-foreground"
        )}
      >
        Não
      </button>
    </div>
  );
}

function OpportunityFlag({ label }: { label: string }) {
  return (
    <p className="text-xs text-amber-600 dark:text-amber-400">
      <span className="font-medium">Oportunidade:</span> {label}
    </p>
  );
}

function boolToHidden(v: boolean | null | undefined): string {
  if (v === null || v === undefined) return "";
  return String(v);
}

const EMPTY_REFS = ["", "", "", "", ""];

export function OnboardingForm({
  clientId,
  defaultValues,
  completedAt,
}: OnboardingFormProps) {
  const router = useRouter();
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved">("idle");
  const [isPending, startTransition] = useTransition();
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const initialState: OnboardingActionState = {};

  const savedFont = splitFontStyles(defaultValues.fontStyles);
  const [fontPresets, setFontPresets] = useState<string[]>(savedFont.presetIds);
  const [fontNotes, setFontNotes] = useState(savedFont.notes);
  const [clientPhotos, setClientPhotos] = useState(
    defaultValues.clientPhotos ?? []
  );

  const savedRefs = Array.isArray(defaultValues.references) && defaultValues.references.length > 0
    ? [...defaultValues.references, ...EMPTY_REFS.slice(defaultValues.references.length)]
    : [...EMPTY_REFS];
  const refInputsRef = useRef<string[]>(savedRefs);
  const [refInputs, setRefInputs] = useState<string[]>(savedRefs);

  const form = useForm<OnboardingFormValues>({
    resolver: zodResolver(onboardingSchema),
    defaultValues: {
      businessDescription: defaultValues.businessDescription ?? "",
      targetAudience: defaultValues.targetAudience ?? "",
      brandPersonality: defaultValues.brandPersonality ?? "",
      competitors: defaultValues.competitors ?? "",
      goals: defaultValues.goals ?? "",
      toneOfVoice: defaultValues.toneOfVoice ?? "",
      visualInspirations: defaultValues.visualInspirations ?? "",
      avoidStyles: defaultValues.avoidStyles ?? "",
      brandColors: defaultValues.brandColors ?? [],
      fontStyles: defaultValues.fontStyles ?? "",
      logoUrl: defaultValues.logoUrl,
      logoStoragePath: defaultValues.logoStoragePath,
      logoQualityOk: defaultValues.logoQualityOk ?? null,
      hasClientImages: defaultValues.hasClientImages ?? null,
      hasSite: defaultValues.hasSite ?? null,
      siteUrl: defaultValues.siteUrl ?? "",
      instagramHandle: defaultValues.instagramHandle ?? "",
      hasGMB: defaultValues.hasGMB ?? null,
      hasVisualIdentity: defaultValues.hasVisualIdentity ?? null,
      visualIdentityOption: defaultValues.visualIdentityOption ?? null,
    },
    mode: "onChange",
  });

  const brandColors = form.watch("brandColors");
  const fontStyles = form.watch("fontStyles");
  const logoUrl = form.watch("logoUrl");
  const logoStoragePath = form.watch("logoStoragePath");
  const logoQualityOk = form.watch("logoQualityOk");
  const hasClientImages = form.watch("hasClientImages");
  const hasSite = form.watch("hasSite");
  const hasGMB = form.watch("hasGMB");
  const hasVisualIdentity = form.watch("hasVisualIdentity");
  const visualIdentityOption = form.watch("visualIdentityOption");

  const persistDraft = useCallback(
    async (values: Partial<OnboardingFormValues>) => {
      setSaveStatus("saving");
      const result = await saveOnboardingDraft(clientId, {
        ...values,
        references: refInputsRef.current.filter((r) => r.trim()),
      });
      if (result.error) {
        setSaveStatus("idle");
        toast.error(result.error);
        return;
      }
      setSaveStatus("saved");
      setTimeout(() => setSaveStatus("idle"), 2000);
    },
    [clientId]
  );

  useEffect(() => {
    const subscription = form.watch((values) => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => {
        persistDraft(values);
      }, 1200);
    });
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      subscription.unsubscribe();
    };
  }, [form, persistDraft]);

  const handleRefChange = (index: number, value: string) => {
    const newRefs = [...refInputsRef.current];
    newRefs[index] = value;
    refInputsRef.current = newRefs;
    setRefInputs([...newRefs]);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      persistDraft(form.getValues());
    }, 1200);
  };

  const onComplete = (formData: FormData) => {
    startTransition(async () => {
      const result = await completeOnboardingAction(
        clientId,
        initialState,
        formData
      );
      if (result.error) {
        toast.error(result.error);
        return;
      }
      toast.success("Onboarding concluído");
      router.push(`/clients/${clientId}`);
      router.refresh();
    });
  };

  return (
    <form action={onComplete} className="space-y-10">
      <div className="flex items-center justify-between gap-4">
        <p className="text-xs text-muted-foreground">
          {completedAt
            ? `Concluído em ${new Date(completedAt).toLocaleDateString("pt-BR")}`
            : "Salvamento automático ativo"}
        </p>
        {saveStatus === "saving" && (
          <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Loader2 className="size-3 animate-spin" />
            Salvando...
          </span>
        )}
        {saveStatus === "saved" && (
          <span className="text-xs text-muted-foreground">Salvo</span>
        )}
      </div>

      {/* ── [1] Identidade Visual ─────────────────────────── */}
      <section className="space-y-8">
        <div>
          <h2 className="text-lg font-medium tracking-heading">
            Identidade Visual
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Cores, tipografia e logo que definem a marca do cliente
          </p>
        </div>

        <Controller
          name="brandColors"
          control={form.control}
          render={({ field, fieldState }) => (
            <BrandColorPicker
              value={field.value ?? []}
              onChange={(colors) => field.onChange(colors)}
              error={fieldState.error?.message}
            />
          )}
        />

        <FontStyleSelector
          selectedPresets={fontPresets}
          customNotes={fontNotes}
          onPresetsChange={setFontPresets}
          onCustomNotesChange={setFontNotes}
          composedValue={fontStyles ?? ""}
          onComposedChange={(value) =>
            form.setValue("fontStyles", value, { shouldDirty: true })
          }
          error={form.formState.errors.fontStyles?.message}
        />

        {/* [2] Logo com qualidade? */}
        <div className="space-y-4">
          <LogoUploadField
            clientId={clientId}
            logoUrl={logoUrl}
            onLogoChange={({ logoUrl: url, logoStoragePath: path }) => {
              form.setValue("logoUrl", url, { shouldDirty: true });
              form.setValue("logoStoragePath", path, { shouldDirty: true });
              persistDraft({
                ...form.getValues(),
                logoUrl: url,
                logoStoragePath: path,
              });
            }}
          />

          <div className="space-y-3 rounded-lg border border-border/50 bg-card/40 p-4">
            <Label>O logo do cliente tem qualidade suficiente para uso?</Label>
            <Controller
              name="logoQualityOk"
              control={form.control}
              render={({ field }) => (
                <YesNoToggle
                  value={field.value}
                  onChange={(v) => field.onChange(v)}
                />
              )}
            />
            {logoQualityOk === false && (
              <OpportunityFlag label="Vetorização de logo necessária" />
            )}
          </div>
        </div>

        {/* [3] Imagens do cliente? */}
        <div className="space-y-4">
          <ClientPhotosField
            clientId={clientId}
            photos={clientPhotos}
            onChange={(photos) => setClientPhotos(photos)}
          />

          <div className="space-y-3 rounded-lg border border-border/50 bg-card/40 p-4">
            <Label>O cliente tem fotos/imagens para uso nos criativos?</Label>
            <Controller
              name="hasClientImages"
              control={form.control}
              render={({ field }) => (
                <YesNoToggle
                  value={field.value}
                  onChange={(v) => field.onChange(v)}
                />
              )}
            />
            {hasClientImages === false && (
              <OpportunityFlag label="Ensaio de IA" />
            )}
          </div>
        </div>
      </section>

      <Separator className="opacity-50" />

      {/* ── [4] Referências ───────────────────────────────── */}
      <section className="space-y-6">
        <div>
          <h2 className="text-lg font-medium tracking-heading">Referências</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Separe até 5 referências como base para os criativos
          </p>
        </div>

        <div className="space-y-3">
          {refInputs.map((ref, i) => (
            <div key={i} className="space-y-1.5 rounded-lg border border-border/50 bg-card/40 p-3">
              <Label className="text-xs text-muted-foreground">Referência {i + 1}</Label>
              <Input
                value={ref}
                onChange={(e) => handleRefChange(i, e.target.value)}
                placeholder="URL ou descrição da referência"
                className="border-border/70 bg-background"
              />
            </div>
          ))}
        </div>
      </section>

      <Separator className="opacity-50" />

      {/* ── [5–7] Canais Digitais ─────────────────────────── */}
      <section className="space-y-6">
        <div>
          <h2 className="text-lg font-medium tracking-heading">
            Canais Digitais
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Presença online do cliente
          </p>
        </div>

        {/* [5] Site? */}
        <div className="space-y-3 rounded-lg border border-border/50 bg-card/40 p-4">
          <Label>O cliente tem site?</Label>
          <Controller
            name="hasSite"
            control={form.control}
            render={({ field }) => (
              <YesNoToggle
                value={field.value}
                onChange={(v) => field.onChange(v)}
              />
            )}
          />
          {hasSite === true && (
            <Input
              {...form.register("siteUrl")}
              placeholder="https://..."
              className="border-border/70 bg-background"
            />
          )}
          {hasSite === false && (
            <OpportunityFlag label="LP ou Site Institucional" />
          )}
        </div>

        {/* [6] Instagram */}
        <div className="space-y-2 rounded-lg border border-border/50 bg-card/40 p-4">
          <Label>Instagram</Label>
          <Input
            {...form.register("instagramHandle")}
            placeholder="@nomedocliente"
            className="border-border/70 bg-background"
          />
        </div>

        {/* [7] Google Meu Negócio? */}
        <div className="space-y-3 rounded-lg border border-border/50 bg-card/40 p-4">
          <Label>O cliente tem Google Meu Negócio?</Label>
          <Controller
            name="hasGMB"
            control={form.control}
            render={({ field }) => (
              <YesNoToggle
                value={field.value}
                onChange={(v) => field.onChange(v)}
              />
            )}
          />
          {hasGMB === false && (
            <OpportunityFlag label="Google Meu Negócio" />
          )}
        </div>
      </section>

      <Separator className="opacity-50" />

      {/* ── [8] ID Visual ─────────────────────────────────── */}
      <section className="space-y-6">
        <div>
          <h2 className="text-lg font-medium tracking-heading">
            Identidade Visual do Cliente
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Defina o ponto de partida visual
          </p>
        </div>

        <div className="space-y-4 rounded-lg border border-border/50 bg-card/40 p-4">
          <div className="space-y-3">
            <Label>O cliente tem identidade visual?</Label>
            <Controller
              name="hasVisualIdentity"
              control={form.control}
              render={({ field }) => (
                <YesNoToggle
                  value={field.value}
                  onChange={(v) => field.onChange(v)}
                />
              )}
            />
          </div>

          {hasVisualIdentity === false && (
            <div className="space-y-2 border-t border-border/40 pt-4">
              <Label className="text-sm text-muted-foreground">Escolha uma opção</Label>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() =>
                    form.setValue(
                      "visualIdentityOption",
                      visualIdentityOption === "sell" ? null : "sell",
                      { shouldDirty: true }
                    )
                  }
                  className={cn(
                    "rounded-lg border px-4 py-2 text-sm font-medium transition-premium",
                    visualIdentityOption === "sell"
                      ? "border-primary/50 bg-primary/10 text-primary"
                      : "border-border bg-card text-muted-foreground hover:border-border/80 hover:text-foreground"
                  )}
                >
                  Opção A — Vender ID Visual
                </button>
                <button
                  type="button"
                  onClick={() =>
                    form.setValue(
                      "visualIdentityOption",
                      visualIdentityOption === "name_only" ? null : "name_only",
                      { shouldDirty: true }
                    )
                  }
                  className={cn(
                    "rounded-lg border px-4 py-2 text-sm font-medium transition-premium",
                    visualIdentityOption === "name_only"
                      ? "border-primary/50 bg-primary/10 text-primary"
                      : "border-border bg-card text-muted-foreground hover:border-border/80 hover:text-foreground"
                  )}
                >
                  Opção B — Usar somente nome
                </button>
              </div>
            </div>
          )}
        </div>
      </section>

      <Separator className="opacity-50" />

      {/* ── Briefing Criativo ─────────────────────────────── */}
      <section className="space-y-6">
        <div>
          <h2 className="text-lg font-medium tracking-heading">
            Briefing Criativo
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Contexto estratégico para geração do Creative Brain
          </p>
        </div>

        {briefingFields.map((field) => (
          <div key={field.name} className="space-y-2 rounded-lg border border-border/50 bg-card/40 p-4">
            <Label htmlFor={field.name} className="text-sm font-medium">
              {field.label}
            </Label>
            {field.rows ? (
              <Textarea
                id={field.name}
                rows={field.rows}
                placeholder={field.placeholder}
                className="border-border/70 bg-background"
                {...form.register(field.name)}
              />
            ) : (
              <Input
                id={field.name}
                placeholder={field.placeholder}
                className="border-border/70 bg-background"
                {...form.register(field.name)}
              />
            )}
            {form.formState.errors[field.name] && (
              <p className="text-xs text-destructive">
                {String(form.formState.errors[field.name]?.message)}
              </p>
            )}
          </div>
        ))}
      </section>

      {/* Hidden inputs para serialização no FormData */}
      <input
        type="hidden"
        name="brandColors"
        value={JSON.stringify(brandColors ?? [])}
        readOnly
      />
      <input type="hidden" name="logoUrl" value={logoUrl ?? ""} readOnly />
      <input
        type="hidden"
        name="logoStoragePath"
        value={logoStoragePath ?? ""}
        readOnly
      />
      <input
        type="hidden"
        name="logoQualityOk"
        value={boolToHidden(logoQualityOk)}
        readOnly
      />
      <input
        type="hidden"
        name="hasClientImages"
        value={boolToHidden(hasClientImages)}
        readOnly
      />
      <input
        type="hidden"
        name="references"
        value={JSON.stringify(refInputs.filter((r) => r.trim()))}
        readOnly
      />
      <input
        type="hidden"
        name="hasSite"
        value={boolToHidden(hasSite)}
        readOnly
      />
      <input
        type="hidden"
        name="hasGMB"
        value={boolToHidden(hasGMB)}
        readOnly
      />
      <input
        type="hidden"
        name="hasVisualIdentity"
        value={boolToHidden(hasVisualIdentity)}
        readOnly
      />
      <input
        type="hidden"
        name="visualIdentityOption"
        value={visualIdentityOption ?? ""}
        readOnly
      />

      <div className="flex flex-wrap gap-3">
        <Button type="submit" disabled={isPending}>
          {isPending ? (
            <>
              <Loader2 className="size-4 animate-spin" />
              Finalizando...
            </>
          ) : (
            "Concluir onboarding"
          )}
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={() => router.push(`/clients/${clientId}`)}
        >
          Voltar ao cliente
        </Button>
      </div>
    </form>
  );
}
