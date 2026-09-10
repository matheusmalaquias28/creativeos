"use client";

import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  useTransition,
} from "react";
import { createPortal } from "react-dom";
import {
  BadgeCheck,
  CalendarClock,
  CheckCircle2,
  Circle,
  Clock,
  FileCheck,
  ListChecks,
  RotateCcw,
  UserCheck,
  Users,
} from "lucide-react";
import { toast } from "sonner";
import { updateDemandStatusAction } from "@/actions/demands";
import { DEMAND_STATUSES, DEMAND_INITIAL_STATUS, isDoneStatus } from "@/types/demand";

type StatusConfig = { label: string; icon: React.ElementType; className: string };

const STATUS_CONFIG: Record<string, StatusConfig> = {
  "Aguardando Definição de Data": {
    label: "Aguardando Data",
    icon: CalendarClock,
    className: "text-amber-600 border-amber-500/40 bg-amber-500/10",
  },
  "Em Fila": {
    label: "Em Fila",
    icon: ListChecks,
    className: "text-cyan-600 border-cyan-500/40 bg-cyan-500/10",
  },
  Fazendo: {
    label: "Fazendo",
    icon: Clock,
    className: "text-blue-600 border-blue-500/40 bg-blue-500/10",
  },
  "Aprovação de Copy": {
    label: "Aprovação de Copy",
    icon: FileCheck,
    className: "text-violet-600 border-violet-500/40 bg-violet-500/10",
  },
  "Aprovação do Gestor": {
    label: "Aprovação do Gestor",
    icon: UserCheck,
    className: "text-violet-600 border-violet-500/40 bg-violet-500/10",
  },
  Ajuste: {
    label: "Ajuste",
    icon: RotateCcw,
    className: "text-orange-600 border-orange-500/40 bg-orange-500/10",
  },
  "Aprovação do Cliente": {
    label: "Aprovação do Cliente",
    icon: Users,
    className: "text-violet-600 border-violet-500/40 bg-violet-500/10",
  },
  Aprovado: {
    label: "Aprovado",
    icon: BadgeCheck,
    className: "text-emerald-600 border-emerald-500/40 bg-emerald-500/10",
  },
  Atrasado: {
    label: "Atrasado",
    icon: Clock,
    className: "text-red-600 border-red-500/40 bg-red-500/10",
  },
  Concluído: {
    label: "Concluído",
    icon: CheckCircle2,
    className: "text-emerald-600 border-emerald-500/40 bg-emerald-500/10",
  },
};

const DEFAULT_STATUS_CONFIG: StatusConfig = {
  label: "Status",
  icon: Circle,
  className: "text-zinc-500 border-zinc-400/40 bg-zinc-500/10",
};

function statusConfig(status: string): StatusConfig {
  return STATUS_CONFIG[status] ?? { ...DEFAULT_STATUS_CONFIG, label: status };
}

type Props = {
  demandId: string;
  currentStatus: string | null;
  /** Status aceitos pelo WAR para esta demanda; cai na lista padrão se vazio. */
  allowedStatuses?: string[];
  onArchived?: () => void;
  onArchiveRevert?: () => void;
  onStatusUpdated?: (status: string) => void;
};

export function DemandStatusSelector({
  demandId,
  currentStatus,
  allowedStatuses,
  onArchived,
  onArchiveRevert,
  onStatusUpdated,
}: Props) {
  const [selected, setSelected] = useState<string>(
    currentStatus ?? DEMAND_INITIAL_STATUS
  );
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

  const config = statusConfig(selected);
  const Icon = config.icon;

  // Lista do menu: status aceitos pela demanda (do WAR) ou o vocabulário padrão.
  // Garante que o status atual apareça mesmo se for custom/fora da lista.
  const menuStatuses = (() => {
    const base =
      allowedStatuses && allowedStatuses.length > 0
        ? allowedStatuses
        : [...DEMAND_STATUSES];
    return base.includes(selected) ? base : [selected, ...base];
  })();

  function handleSelect(status: string) {
    if (status === selected || isPending) return;

    setOpen(false);
    const prev = selected;
    setSelected(status);

    const isCompleting = isDoneStatus(status);
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
          onStatusUpdated?.(prev);
        }
        toast.error("Erro ao atualizar status", { description: result.error });
        return;
      }

      toast.success(
        isCompleting
          ? "Demanda concluída e arquivada"
          : `Status atualizado: ${statusConfig(status).label}`
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
              {menuStatuses.map((status) => {
                const c = statusConfig(status);
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
