"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Check } from "lucide-react";
import {
  approveCreativeBrainAction,
} from "@/actions/creative-brain";
import { GenerateBrainButton } from "@/components/creative-brain/generate-brain-button";
import { Badge } from "@/components/ui/badge";
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
    <div className="flex flex-wrap items-center gap-2">
      {status === "approved" && (
        <Badge variant="green" className="h-8 gap-1.5 px-3 text-[0.8125rem]">
          <Check className="size-3.5" strokeWidth={2.5} />
          Aprovado
        </Badge>
      )}
      <GenerateBrainButton
        clientId={clientId}
        disabled={!canGenerate}
        label="Reprocessar Creative Brain"
        variant="outline"
      />
      {status === "draft" && (
        <Button
          type="button"
          onClick={handleApprove}
          disabled={isPending}
        >
          <Check className="size-4" />
          Aprovar Brand DNA
        </Button>
      )}
    </div>
  );
}
