"use client";

import { useCallback, useEffect, useRef, useState, useTransition, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Check, Cloud, ImageIcon, Images, Library, Loader2, Sparkles } from "lucide-react";
import {
  completeOnboardingAction,
  saveOnboardingDraft,
  type OnboardingActionState,
} from "@/actions/onboarding";
import { onboardingSchema, type OnboardingFormValues } from "@/lib/schemas/client";
import type { ClientPhotoRow } from "@/types/client-photos";
import type { ClientVisualIdentityState } from "@/lib/schemas/visual-identity";
import { isVisualIdentityReady } from "@/lib/schemas/visual-identity";
import { LogoUploadField } from "@/components/clients/logo-upload-field";
import { ClientPhotosField } from "@/components/clients/client-photos-field";
import { VisualIdentityField } from "@/components/clients/visual-identity-field";
import { ReferenceBank } from "@/components/art-director/reference-bank";
import type { ReferenceAssetRow } from "@/services/reference-assets";
import { Button } from "@/components/ui/button";
import { tones, type Tone } from "@/lib/design/tokens";
import { cn } from "@/lib/utils";

type OnboardingFormProps = {
  clientId: string;
  defaultValues: Partial<OnboardingFormValues> & { clientPhotos?: ClientPhotoRow[] };
  visualIdentity: ClientVisualIdentityState;
  /** Acervo de referências — a única fonte que a geração de artes lê. */
  referenceAssets: ReferenceAssetRow[];
  completedAt: string | null;
};

function BriefingColumn({
  icon: Icon,
  step,
  title,
  description,
  tone = "violet",
  children,
  className,
}: {
  icon: typeof ImageIcon;
  step: number;
  title: string;
  description: string;
  tone?: Tone;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("surface-panel flex min-h-[320px] flex-col gap-4 p-5", className)}>
      <div className="flex items-start gap-3">
        <span
          className={cn(
            "flex size-9 shrink-0 items-center justify-center rounded-xl",
            tones[tone].iconTile
          )}
        >
          <Icon className="size-4" strokeWidth={2} />
        </span>
        <div className="min-w-0 space-y-0.5">
          <p className="text-[0.75rem] font-semibold text-muted-foreground">Passo {step}</p>
          <h2 className="text-sm font-bold tracking-tight text-foreground">{title}</h2>
          <p className="text-xs leading-relaxed text-muted-foreground">{description}</p>
        </div>
      </div>
      <div className="flex flex-1 flex-col">{children}</div>
    </div>
  );
}

export function OnboardingForm({
  clientId,
  defaultValues,
  visualIdentity,
  referenceAssets,
  completedAt,
}: OnboardingFormProps) {
  const router = useRouter();
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved">("idle");
  const [isPending, startTransition] = useTransition();
  const [identityState, setIdentityState] = useState(visualIdentity);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const initialState: OnboardingActionState = {};

  const [clientPhotos, setClientPhotos] = useState(defaultValues.clientPhotos ?? []);

  const form = useForm<OnboardingFormValues>({
    resolver: zodResolver(onboardingSchema),
    defaultValues: {
      logoUrl: defaultValues.logoUrl,
      logoStoragePath: defaultValues.logoStoragePath,
    },
    mode: "onChange",
  });

  const logoUrl = form.watch("logoUrl");
  const logoStoragePath = form.watch("logoStoragePath");
  const identityReady = isVisualIdentityReady(identityState);
  const referenceCount = referenceAssets.length;
  const bankReferenceUrls = referenceAssets.map((a) => a.storage_url);
  // O que o kit exige para a demanda gerar: logo, 1 referência no acervo e DNA.
  const missing = [
    !logoUrl ? "a logo" : null,
    referenceCount < 1 ? "ao menos 1 referência" : null,
    !identityReady ? "o DNA visual extraído" : null,
  ].filter(Boolean) as string[];
  const canComplete = missing.length === 0;

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
    if (!canComplete) {
      toast.error(`Falta ${missing.join(", ")}`);
      return;
    }

    startTransition(async () => {
      const result = await completeOnboardingAction(clientId, initialState, formData);
      if (result.error) {
        toast.error(result.error);
        return;
      }
      toast.success("Briefing concluído");
      router.push(`/clients/${clientId}`);
      router.refresh();
    });
  };

  return (
    <form action={onComplete} className="space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-surface px-4 py-2.5">
        <p className="flex items-center gap-2 text-[0.8125rem] text-muted-foreground">
          {completedAt ? (
            <>
              <span className={cn("size-1.5 rounded-full", tones.green.dot)} />
              Concluído em {new Date(completedAt).toLocaleDateString("pt-BR")}
            </>
          ) : (
            <>
              <Cloud className="size-3.5" strokeWidth={2} />
              Salvamento automático ativo
            </>
          )}
        </p>
        {saveStatus === "saving" && (
          <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Loader2 className="size-3 animate-spin" />
            Salvando...
          </span>
        )}
        {saveStatus === "saved" && (
          <span className={cn("flex items-center gap-1.5 text-xs font-semibold", tones.green.text)}>
            <Check className="size-3" strokeWidth={2.5} />
            Salvo
          </span>
        )}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <BriefingColumn
          icon={ImageIcon}
          step={1}
          tone="orange"
          title="Logo"
          description="Logo oficial, composta no topo de toda arte gerada. Obrigatória."
        >
          <LogoUploadField
            compact
            clientId={clientId}
            logoUrl={logoUrl}
            onLogoChange={({ logoUrl: url, logoStoragePath: path }) => {
              form.setValue("logoUrl", url, { shouldDirty: true });
              form.setValue("logoStoragePath", path, { shouldDirty: true });
              persistDraft({ ...form.getValues(), logoUrl: url, logoStoragePath: path });
            }}
          />
        </BriefingColumn>

        <BriefingColumn
          icon={Images}
          step={2}
          tone="cyan"
          title="Imagens do cliente"
          description="Produto, espaço, pessoas — até 5. Opcional: entram só nas artes em que você pedir."
        >
          <ClientPhotosField
            compact
            clientId={clientId}
            photos={clientPhotos}
            onChange={(photos) => setClientPhotos(photos)}
          />
        </BriefingColumn>
      </div>

      <BriefingColumn
        icon={Library}
        step={3}
        tone="violet"
        title={`Referências (${referenceCount})`}
        description="O acervo que o diretor de arte lê para escolher layout, tipografia e acabamento. Cada imagem é anotada por IA no upload. Mínimo 1 — é este acervo, e só ele, que libera a geração."
        className="min-h-0"
      >
        <ReferenceBank clientId={clientId} assets={referenceAssets} />
      </BriefingColumn>

      <BriefingColumn
        icon={Sparkles}
        step={4}
        tone="pink"
        title="Extrator de DNA"
        description="Artes que representam a marca. A IA lê cores, tipografia e mood e grava como memória do cliente. Você pode reaproveitar as referências do acervo."
        className="min-h-0"
      >
        <VisualIdentityField
          clientId={clientId}
          state={identityState}
          onStateChange={setIdentityState}
          bankReferenceUrls={bankReferenceUrls}
        />
      </BriefingColumn>

      <input type="hidden" name="logoUrl" value={logoUrl ?? ""} readOnly />
      <input type="hidden" name="logoStoragePath" value={logoStoragePath ?? ""} readOnly />

      <div className="flex flex-wrap items-center gap-3 border-t border-border pt-6">
        <Button type="submit" disabled={isPending || !canComplete}>
          {isPending ? (
            <>
              <Loader2 className="size-4 animate-spin" />
              Finalizando...
            </>
          ) : (
            "Concluir briefing"
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

      {!canComplete && (
        <p className="text-xs text-muted-foreground">
          {identityState.identityExtractionStatus === "extracting"
            ? "Extraindo o DNA visual — aguarde para concluir."
            : `Falta ${missing.join(", ")} para concluir o cadastro.`}
        </p>
      )}

    </form>
  );
}
