"use client";

import { Suspense, useEffect, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { Plus, UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { CreateClientForm } from "@/components/clients/create-client-form";
import { tones } from "@/lib/design/tokens";
import { cn } from "@/lib/utils";

type NewClientDialogProps = {
  label?: string;
  variant?: "default" | "outline" | "highlight";
  size?: "default" | "sm";
};

/**
 * Botão "Novo cliente" + dialog. Abre sozinho quando a URL tem `?novo=1`
 * (atalho do command menu).
 */
export function NewClientDialog(props: NewClientDialogProps) {
  // useSearchParams exige Suspense; o fallback é o próprio botão (sem dialog).
  return (
    <Suspense
      fallback={
        <Button variant={props.variant ?? "default"} size={props.size ?? "default"} disabled>
          <Plus className="size-4" strokeWidth={2.25} />
          {props.label ?? "Novo cliente"}
        </Button>
      }
    >
      <NewClientDialogInner {...props} />
    </Suspense>
  );
}

function NewClientDialogInner({
  label = "Novo cliente",
  variant = "default",
  size = "default",
}: NewClientDialogProps) {
  const [open, setOpen] = useState(false);
  const searchParams = useSearchParams();
  const pathname = usePathname();

  useEffect(() => {
    if (searchParams.get("novo") === "1") {
      setOpen(true);
      const params = new URLSearchParams(searchParams.toString());
      params.delete("novo");
      const qs = params.toString();
      // replaceState (e não router.replace) para não remontar o dialog recém-aberto.
      window.history.replaceState(null, "", qs ? `${pathname}?${qs}` : pathname);
    }
  }, [pathname, searchParams]);

  return (
    <>
      <Button variant={variant} size={size} onClick={() => setOpen(true)}>
        <Plus className="size-4" strokeWidth={2.25} />
        {label}
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <div className="mb-2 flex">
              <span
                className={cn(
                  "flex size-10 items-center justify-center rounded-xl",
                  tones.orange.iconTile
                )}
              >
                <UserPlus className="size-[1.125rem]" strokeWidth={2} />
              </span>
            </div>
            <DialogTitle>Novo cliente</DialogTitle>
            <DialogDescription>
              Cadastre a marca para iniciar o onboarding e a geração do Brand DNA.
            </DialogDescription>
          </DialogHeader>
          <DialogBody className="pb-6">
            <CreateClientForm layout="stacked" autoFocus />
          </DialogBody>
        </DialogContent>
      </Dialog>
    </>
  );
}
