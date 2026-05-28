"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Check } from "lucide-react";
import {
  approveCreativeBrainAction,
} from "@/actions/creative-brain";
import { GenerateBrainButton } from "@/components/creative-brain/generate-brain-button";
import { Button } from "@/components/ui/button";
import type { CreativeBrainStatus } from "@/types";

type BrainActionsProps = {
  clientId: string;
  brainId: string;
  status: CreativeBrainStatus;
  canGenerate: boolean;
};

export function BrainActions({
  clientId,
  brainId,
  status,
  canGenerate,
}: BrainActionsProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const handleApprove = () => {
    startTransition(async () => {
      const result = await approveCreativeBrainAction(clientId, brainId);
      if (result.error) toast.error(result.error);
      else {
        toast.success("Creative Brain aprovado");
        router.refresh();
      }
    });
  };

  return (
    <div className="flex flex-wrap gap-3">
      {status === "draft" && (
        <Button
          type="button"
          onClick={handleApprove}
          disabled={isPending}
          className="gap-2"
        >
          <Check className="size-4" />
          Aprovar Brand DNA
        </Button>
      )}
      {status === "approved" && (
        <span className="flex items-center gap-2 rounded-lg border border-border/50 bg-muted/30 px-3 py-2 text-sm text-muted-foreground">
          <Check className="size-4 text-foreground/70" />
          Aprovado
        </span>
      )}
      <GenerateBrainButton
        clientId={clientId}
        disabled={!canGenerate}
        label="Reprocessar Creative Brain"
      />
    </div>
  );
}
