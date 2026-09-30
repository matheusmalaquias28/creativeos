"use client";

import { useCallback, useEffect, useRef, useState, useTransition, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Check, Cloud, ImageIcon, Images, Loader2, Sparkles } from "lucide-react";
import {
  completeOnboardingAction,
  saveOnboardingDraft,
  type OnboardingActionState,
} from "@/actions/onboarding";
import { onboardingSchema, type OnboardingFormValues } from "@/lib/schemas/client";
import type { ClientPhotoRow } from "@/types/client-photos";
import type { ClientVisualIdentityState } from "@/lib/schemas/visual-identity";
import { resolveVisualMode } from "@/lib/ai/art-director/visual-policy";
import { LogoUploadField } from "@/components/clients/logo-upload-field";
import { ClientPhotosField } from "@/components/clients/client-photos-field";
import { VisualIdentityField } from "@/components/clients/visual-identity-field";
import { Button } from "@/components/ui/button";
import { tones, type Tone } from "@/lib/design/tokens";
import { cn } from "@/lib/utils";

type OnboardingFormProps = {
  clientId: string;
  defaultValues: Partial<OnboardingFormValues> & { clientPhotos?: ClientPhotoRow[] };
  visualIdentity: ClientVisualIdentityState;
  completedAt: string | null;
};

function BriefingColumn({
  icon: Icon,
  step,
  title,
  description,
  tone = "violet",
  children,
}: {
  icon: typeof ImageIcon;
  step: number;
  title: string;
  description: string;
  tone?: Tone;
  children: ReactNode;
}) {
  return (
    <div className="surface-panel flex min-h-[320px] flex-col gap-4 p-5">
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
      visualMode: resolveVisualMode(defaultValues.visualMode, Boolean(visualIdentity.visualIdentityDna)),
      visualNotes: defaultValues.visualNotes ?? "",
    },
    mode: "onChange",
  });

  const logoUrl = form.watch("logoUrl");
  const logoStoragePath = form.watch("logoStoragePath");
  const visualMode = form.watch("visualMode");

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
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!logoUrl) {
      toast.error("Cadastre a logo do cliente para concluir");
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

      <section className="surface-panel space-y-4 p-5">
        <h2 className="text-sm font-bold">Como criar para este cliente?</h2>
        <p className="text-sm text-muted-foreground">Cadastre a logo e escolha a liberdade visual. A copy vem da demanda; fotos e referências são opcionais.</p>
        <label className="block space-y-2 text-sm">
          <span>Direção visual</span>
          <select {...form.register("visualMode")} className="w-full rounded-lg border border-border bg-background p-3">
            <option value="free">Criação livre — a IA decide o visual a partir da copy</option>
            <option value="guided">Seguir minhas orientações — cores, preferências e restrições</option>
            <option value="brand">Seguir identidade existente — usar as referências da marca</option>
          </select>
        </label>
        <label className="block space-y-2 text-sm">
          <span>Preferências do cliente (opcional)</span>
          <textarea {...form.register("visualNotes")} maxLength={2000} rows={3} className="w-full rounded-lg border border-border bg-background p-3" placeholder="Ex.: usar azul e creme, tipografia editorial, evitar fotos de pessoas." />
        </label>
      </section>
      <div className="grid gap-4 lg:grid-cols-3">
        <BriefingColumn
          icon={ImageIcon}
          step={1}
          tone="orange"
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
          icon={Images}
          step={2}
          tone="cyan"
          title="Fotos opcionais"
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
          step={3}
          tone="pink"
          title="Identidade visual opcional"
          description="Use artes existentes quando houver uma identidade a seguir. Elas também ficam disponíveis para a geração das demandas."
        >
          {visualMode !== "brand" && <p className="mb-3 text-xs text-muted-foreground">Você pode concluir sem enviar referências. A IA cria a direção a partir da copy.</p>}
          <VisualIdentityField
            compact
            clientId={clientId}
            state={identityState}
            onStateChange={setIdentityState}
          />
        </BriefingColumn>
      </div>

      <input type="hidden" name="logoUrl" value={logoUrl ?? ""} readOnly />
      <input type="hidden" name="logoStoragePath" value={logoStoragePath ?? ""} readOnly />

      <div className="flex flex-wrap items-center gap-3 border-t border-border pt-6">
        <Button type="submit" disabled={isPending || !logoUrl}>
          {isPending ? (
            <>
              <Loader2 className="size-4 animate-spin" />
              Finalizando...
            </>
          ) : (
            "Salvar cliente"
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
