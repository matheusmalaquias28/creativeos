"use client";

import { useCallback, useEffect, useRef, useState, useTransition, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { ImageIcon, Loader2, Sparkles } from "lucide-react";
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
import {
  VisualIdentityDnaPreview,
  VisualIdentityField,
} from "@/components/clients/visual-identity-field";
import { Button } from "@/components/ui/button";

type OnboardingFormProps = {
  clientId: string;
  defaultValues: Partial<OnboardingFormValues> & { clientPhotos?: ClientPhotoRow[] };
  visualIdentity: ClientVisualIdentityState;
  completedAt: string | null;
};

function BriefingColumn({
  icon: Icon,
  title,
  description,
  accent = "text-foreground/60",
  children,
}: {
  icon: typeof ImageIcon;
  title: string;
  description: string;
  accent?: string;
  children: ReactNode;
}) {
  return (
    <div className="flex min-h-[320px] flex-col gap-3 rounded-xl border border-white/8 bg-card/20 p-4 backdrop-blur-sm">
      <div className="space-y-1">
        <div className="flex items-center gap-2">
          <Icon className={`size-4 ${accent}`} strokeWidth={1.5} />
          <h2 className="text-sm font-semibold tracking-heading text-foreground">{title}</h2>
        </div>
        <p className="text-xs leading-relaxed text-muted-foreground">{description}</p>
      </div>
      <div className="flex flex-1 flex-col">{children}</div>
    </div>
  );
}

export function OnboardingForm({
  clientId,
  defaultValues,
  visualIdentity,
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

  useEffect(() => {
    if (identityState.identityExtractionStatus !== "extracting") return;
    const timer = setInterval(() => router.refresh(), 4000);
    return () => clearInterval(timer);
  }, [identityState.identityExtractionStatus, router]);

  const onComplete = (formData: FormData) => {
    if (!identityReady) {
      toast.error("Aguarde a extração do DNA visual antes de concluir");
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

      <div className="grid gap-4 lg:grid-cols-3">
        <BriefingColumn
          icon={ImageIcon}
          title="Logo"
          description="Logo oficial para composição nas artes."
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
          icon={ImageIcon}
          title="Fotos"
          description="Produto, espaço ou contexto da marca — até 5 imagens."
        >
          <ClientPhotosField
            compact
            clientId={clientId}
            photos={clientPhotos}
            onChange={(photos) => setClientPhotos(photos)}
          />
        </BriefingColumn>

        <BriefingColumn
          icon={Sparkles}
          title="Extrator"
          description="Arte de referência para a IA extrair cores, tipografia e estilo."
          accent="text-foreground/60"
        >
          <VisualIdentityField
            compact
            showDnaDetails={false}
            clientId={clientId}
            state={identityState}
            onStateChange={setIdentityState}
          />
        </BriefingColumn>
      </div>

      <VisualIdentityDnaPreview state={identityState} />

      <input type="hidden" name="logoUrl" value={logoUrl ?? ""} readOnly />
      <input type="hidden" name="logoStoragePath" value={logoStoragePath ?? ""} readOnly />

      <div className="flex flex-wrap gap-3">
        <Button type="submit" disabled={isPending || !identityReady}>
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

      {!identityReady && (
        <p className="text-xs text-muted-foreground">
          {identityState.identityExtractionStatus === "extracting"
            ? "Aguarde a extração do DNA visual para concluir."
            : "Envie uma arte de referência no extrator para concluir."}
        </p>
      )}
    </form>
  );
}
