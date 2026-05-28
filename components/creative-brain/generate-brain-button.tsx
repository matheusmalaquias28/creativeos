"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Brain, Loader2 } from "lucide-react";
import { generateCreativeBrainAction } from "@/actions/creative-brain";
import { CreativeBrainGeneratingModal } from "@/components/creative-brain/creative-brain-generating-modal";
import { Button } from "@/components/ui/button";

type GenerateBrainButtonProps = {
  clientId: string;
  disabled?: boolean;
  label?: string;
};

export function GenerateBrainButton({
  clientId,
  disabled,
  label = "Gerar Creative Brain",
}: GenerateBrainButtonProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [modalOpen, setModalOpen] = useState(false);

  const handleGenerate = () => {
    setModalOpen(true);
    startTransition(async () => {
      const result = await generateCreativeBrainAction(clientId);
      setModalOpen(false);

      if (result.error) {
        toast.error(result.error);
        if (result.brainId) {
          router.push(`/clients/${clientId}/brain?brain=${result.brainId}`);
        }
        router.refresh();
        return;
      }

      toast.success("Creative Brain gerado com sucesso");
      if (result.brainId) {
        router.push(`/clients/${clientId}/brain?brain=${result.brainId}`);
      } else {
        router.push(`/clients/${clientId}/brain`);
      }
      router.refresh();
    });
  };

  const loading = isPending || modalOpen;

  return (
    <>
      <CreativeBrainGeneratingModal open={modalOpen} />
      <Button
        type="button"
        onClick={handleGenerate}
        disabled={disabled || loading}
        className="gap-2"
      >
        {isPending ? (
          <>
            <Loader2 className="size-4 animate-spin" />
            Gerando...
          </>
        ) : (
          <>
            <Brain className="size-4" strokeWidth={1.75} />
            {label}
          </>
        )}
      </Button>
    </>
  );
}
