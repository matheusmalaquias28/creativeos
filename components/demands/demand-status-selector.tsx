"use client";

import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  useTransition,
} from "react";
import { createPortal } from "react-dom";
import { CheckCircle2, Circle, Clock, RotateCcw, XCircle } from "lucide-react";
import { toast } from "sonner";
import { updateDemandStatusAction } from "@/actions/demands";
import { DEMAND_STATUSES } from "@/types/demand";
import type { DemandStatus } from "@/types/demand";

const STATUS_CONFIG: Record<
  DemandStatus,
  { label: string; icon: React.ElementType; className: string }
> = {
  Nova: {
    label: "Nova",
    icon: Circle,
    className: "text-blue-600 border-blue-500/40 bg-blue-500/10",
  },
  Fazendo: {
    label: "Fazendo",
    icon: Clock,
    className: "text-amber-600 border-amber-500/40 bg-amber-500/10",
  },
  Revisão: {
    label: "Revisão",
    icon: RotateCcw,
    className: "text-purple-600 border-purple-500/40 bg-purple-500/10",
  },
  Concluída: {
    label: "Concluída",
    icon: CheckCircle2,
    className: "text-emerald-600 border-emerald-500/40 bg-emerald-500/10",
  },
  Cancelada: {
    label: "Cancelada",
    icon: XCircle,
    className: "text-zinc-500 border-zinc-400/40 bg-zinc-500/10",
  },
};

type Props = {
  demandId: string;
  currentStatus: string | null;
  onArchived?: () => void;
  onArchiveRevert?: () => void;
  onStatusUpdated?: (status: DemandStatus) => void;
};

export function DemandStatusSelector({
  demandId,
  currentStatus,
  onArchived,
  onArchiveRevert,
  onStatusUpdated,
}: Props) {
  const [selected, setSelected] = useState<string>(currentStatus ?? "Nova");
  const [open, setOpen] = useState(false);
  const [menuPos, setMenuPos] = useState<{ top: number; left: number } | null>(
    null
  );
  const [mounted, setMounted] = useState(false);
  const [isPending, startTransition] = useTransition();
  const triggerRef = useRef<HTMLButtonElement>(null);

  useEffect(() => setMounted(true), []);

  useLayoutEffect(() => {
    if (!open || !triggerRef.current) return;

    const updatePosition = () => {
      const rect = triggerRef.current!.getBoundingClientRect();
      setMenuPos({ top: rect.bottom + 6, left: rect.left });
    };

    updatePosition();
    window.addEventListener("scroll", updatePosition, true);
    window.addEventListener("resize", updatePosition);

    return () => {
      window.removeEventListener("scroll", updatePosition, true);
      window.removeEventListener("resize", updatePosition);
    };
  }, [open]);

  const config =
    STATUS_CONFIG[selected as DemandStatus] ?? STATUS_CONFIG["Nova"];
  const Icon = config.icon;

  function handleSelect(status: DemandStatus) {
    if (status === selected || isPending) return;

    setOpen(false);
    const prev = selected;
    setSelected(status);

    const isCompleting = status === "Concluída";
    if (isCompleting) {
      onArchived?.();
    } else {
      onStatusUpdated?.(status);
    }

    startTransition(async () => {
      const result = await updateDemandStatusAction(demandId, status);
      if (result.error) {
        setSelected(prev);
        if (isCompleting) {
          onArchiveRevert?.();
        } else {
          onStatusUpdated?.(prev as DemandStatus);
        }
        toast.error("Erro ao atualizar status", { description: result.error });
        return;
      }

      toast.success(
        isCompleting
          ? "Demanda concluída e arquivada"
          : `Status atualizado: ${status}`
      );
    });
  }

  const menu =
    mounted && open && menuPos
      ? createPortal(
          <>
            <div
              className="fixed inset-0 z-40"
              aria-hidden
              onClick={() => setOpen(false)}
            />
            <div
              role="menu"
              className="fixed z-50 min-w-[168px] overflow-hidden rounded-xl border border-border/60 bg-popover p-1 shadow-xl"
              style={{ top: menuPos.top, left: menuPos.left }}
            >
              {DEMAND_STATUSES.map((status) => {
                const c = STATUS_CONFIG[status];
                const SIcon = c.icon;
                return (
                  <button
                    key={status}
                    type="button"
                    role="menuitem"
                    onClick={() => handleSelect(status)}
                    className={`flex w-full items-center gap-2 rounded-md px-3 py-2 text-xs transition-colors hover:bg-accent ${
                      selected === status ? "bg-accent/60 font-medium" : ""
                    }`}
                  >
                    <SIcon
                      className={`size-3.5 ${c.className.split(" ")[0]}`}
                    />
                    {c.label}
                  </button>
                );
              })}
            </div>
          </>,
          document.body
        )
      : null;

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        disabled={isPending}
        onClick={() => setOpen((value) => !value)}
        className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition-all outline-none ${config.className} disabled:opacity-60`}
      >
        <Icon className="size-3.5" />
        {config.label}
        <span className="ml-0.5 text-[0.6rem] opacity-60">▾</span>
      </button>
      {menu}
    </>
  );
}
