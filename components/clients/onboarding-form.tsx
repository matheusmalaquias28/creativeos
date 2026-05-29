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
import { onboardingSchema, type OnboardingFormValues, type ClientPhoto } from "@/lib/schemas/client";
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

type OnboardingFormProps = {
  clientId: string;
  defaultValues: Partial<OnboardingFormValues> & { clientPhotos?: ClientPhoto[] };
  completedAt: string | null;
};

const briefingFields: {
  name: keyof OnboardingFormValues;
  label: string;
  placeholder: string;
  required?: boolean;
  rows?: number;
}[] = [
  {
    name: "businessDescription",
    label: "Descrição do negócio",
    placeholder: "O que a marca faz, posicionamento, diferenciais...",
    required: true,
    rows: 4,
  },
  {
    name: "targetAudience",
    label: "Público-alvo",
    placeholder: "Quem são os clientes ideais?",
    required: true,
    rows: 3,
  },
  {
    name: "brandPersonality",
    label: "Personalidade da marca",
    placeholder: "Como a marca se comporta e se comunica?",
    required: true,
    rows: 2,
  },
  {
    name: "toneOfVoice",
    label: "Tom de voz",
    placeholder: "Formal, ousado, acolhedor...",
    required: true,
    rows: 2,
  },
  {
    name: "goals",
    label: "Objetivos da campanha",
    placeholder: "Conversão, awareness, lançamento...",
    required: true,
    rows: 3,
  },
  {
    name: "competitors",
    label: "Concorrentes",
    placeholder: "Opcional — principais referências do mercado",
    rows: 2,
  },
  {
    name: "visualInspirations",
    label: "Inspirações visuais",
    placeholder: "Opcional — estéticas, marcas ou referências",
    rows: 2,
  },
  {
    name: "avoidStyles",
    label: "Estilos a evitar",
    placeholder: "Opcional — o que não deve aparecer nos criativos",
    rows: 2,
  },
];

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
    },
    mode: "onChange",
  });

  const brandColors = form.watch("brandColors");
  const fontStyles = form.watch("fontStyles");
  const logoUrl = form.watch("logoUrl");
  const logoStoragePath = form.watch("logoStoragePath");

  const persistDraft = useCallback(
    async (values: Partial<OnboardingFormValues>) => {
      setSaveStatus("saving");
      const result = await saveOnboardingDraft(clientId, values);
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

      <section className="space-y-8">
        <div>
          <h2 className="text-lg font-medium tracking-heading">
            Identidade visual
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
              onChange={(colors) => {
                field.onChange(colors);
              }}
              error={fieldState.error?.message}
            />
          )}
        />

        <FontStyleSelector
          selectedPresets={fontPresets}
          customNotes={fontNotes}
          onPresetsChange={setFontPresets}
          onCustomNotesChange={setFontNotes}
          composedValue={fontStyles}
          onComposedChange={(value) => form.setValue("fontStyles", value, { shouldDirty: true })}
          error={form.formState.errors.fontStyles?.message}
        />

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

        <ClientPhotosField
          clientId={clientId}
          photos={clientPhotos}
          onChange={(photos) => setClientPhotos(photos)}
        />
      </section>

      <Separator className="opacity-50" />

      <section className="space-y-6">
        <div>
          <h2 className="text-lg font-medium tracking-heading">
            Briefing criativo
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Contexto estratégico para geração do Creative Brain
          </p>
        </div>

        {briefingFields.map((field) => (
          <div key={field.name} className="space-y-2">
            <Label htmlFor={field.name}>
              {field.label}
              {field.required && (
                <span className="ml-1 text-destructive">*</span>
              )}
            </Label>
            {field.rows ? (
              <Textarea
                id={field.name}
                rows={field.rows}
                placeholder={field.placeholder}
                {...form.register(field.name)}
              />
            ) : (
              <Input
                id={field.name}
                placeholder={field.placeholder}
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
