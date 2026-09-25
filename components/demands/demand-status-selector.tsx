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
  ChevronDown,
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
import { tones, type Tone } from "@/lib/design/tokens";
import { cn } from "@/lib/utils";

type StatusConfig = { label: string; icon: React.ElementType; tone: Tone };

const STATUS_CONFIG: Record<string, StatusConfig> = {
  "Aguardando Definição de Data": {
    label: "Aguardando Data",
    icon: CalendarClock,
    tone: "amber",
  },
  "Em Fila": {
    label: "Em Fila",
    icon: ListChecks,
    tone: "cyan",
  },
  Fazendo: {
    label: "Fazendo",
    icon: Clock,
    tone: "blue",
  },
  "Aprovação de Copy": {
    label: "Aprovação de Copy",
    icon: FileCheck,
    tone: "violet",
  },
  "Aprovação do Gestor": {
    label: "Aprovação do Gestor",
    icon: UserCheck,
    tone: "violet",
  },
  Ajuste: {
    label: "Ajuste",
    icon: RotateCcw,
    tone: "orange",
  },
  "Aprovação do Cliente": {
    label: "Aprovação do Cliente",
    icon: Users,
    tone: "violet",
  },
  Aprovado: {
    label: "Aprovado",
    icon: BadgeCheck,
    tone: "green",
  },
  Atrasado: {
    label: "Atrasado",
    icon: Clock,
    tone: "red",
  },
  Concluído: {
    label: "Concluído",
    icon: CheckCircle2,
    tone: "green",
  },
};

const DEFAULT_STATUS_CONFIG: StatusConfig = {
  label: "Status",
  icon: Circle,
  tone: "slate",
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
              className="fixed z-50 min-w-[188px] overflow-hidden rounded-xl border border-border bg-popover p-1 shadow-[var(--surface-shadow-elevated),var(--inner-highlight)]"
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
                    className={cn(
                      "flex w-full items-center gap-2 rounded-lg px-3 py-2 text-[0.8125rem] text-foreground transition-colors hover:bg-accent",
                      selected === status && "bg-accent font-semibold"
                    )}
                  >
                    <SIcon className={cn("size-3.5", tones[c.tone].text)} />
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
        className={cn(
          "inline-flex h-8 items-center gap-1.5 rounded-full border px-3 text-xs font-semibold transition-premium outline-none hover:brightness-110 focus-visible:ring-2 focus-visible:ring-ring/50 disabled:opacity-60",
          tones[config.tone].badge
        )}
      >
        <Icon className="size-3.5" />
        {config.label}
        <ChevronDown className="size-3 opacity-70" />
      </button>
      {menu}
    </>
  );
}
