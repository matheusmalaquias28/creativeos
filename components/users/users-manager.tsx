"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  Ban,
  Check,
  Copy,
  Crown,
  Eye,
  EyeOff,
  KeyRound,
  Layers,
  Loader2,
  Pencil,
  Plus,
  RotateCcw,
  ShieldCheck,
  Trash2,
  UserPlus,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import {
  ASSIGNABLE_ROLES,
  ROLE_DESCRIPTIONS,
  ROLE_LABELS,
  type AppRole,
  type AssignableRole,
} from "@/lib/auth/permissions";
import {
  createUserAction,
  deleteUserAction,
  setUserDisabledAction,
  updateUserAction,
} from "@/actions/users-admin";
import type { ManagedUser } from "@/services/users-admin";

const ROLE_BADGE: Record<AppRole, React.ComponentProps<typeof Badge>["variant"]> = {
  super_admin: "violet",
  admin: "blue",
  carousel_creator: "lime",
  member: "secondary",
};

const ROLE_ICON: Record<AppRole, React.ComponentType<{ className?: string }>> = {
  super_admin: Crown,
  admin: ShieldCheck,
  carousel_creator: Layers,
  member: Ban,
};

function formatDate(value: string | null) {
  if (!value) return "Nunca entrou";
  return new Date(value).toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" });
}

function generatePassword() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789";
  const bytes = crypto.getRandomValues(new Uint32Array(12));
  return Array.from(bytes, (b) => chars[b % chars.length]).join("");
}

// ─── Campos reutilizados ─────────────────────────────────────────────────────

function Field({ id, label, children, hint }: { id: string; label: string; children: React.ReactNode; hint?: string }) {
  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="text-[0.8125rem] font-semibold text-foreground">
        {label}
      </label>
      {children}
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

function RolePicker({ value, onChange }: { value: AssignableRole; onChange: (r: AssignableRole) => void }) {
  return (
    <div className="space-y-1.5">
      <p className="text-[0.8125rem] font-semibold text-foreground">Permissão</p>
      <div role="radiogroup" className="grid gap-2 sm:grid-cols-2">
        {ASSIGNABLE_ROLES.map((role) => {
          const Icon = ROLE_ICON[role];
          const active = value === role;
          return (
            <button
              key={role}
              type="button"
              role="radio"
              aria-checked={active}
              onClick={() => onChange(role)}
              className={cn(
                "flex items-start gap-2.5 rounded-xl border p-3 text-left transition-premium outline-none focus-visible:ring-2 focus-visible:ring-ring/50",
                active
                  ? "border-primary/60 bg-primary/10 ring-1 ring-primary/30"
                  : "border-border bg-surface hover:border-border-strong hover:bg-accent"
              )}
            >
              <Icon className={cn("mt-0.5 size-4 shrink-0", active ? "text-primary" : "text-muted-foreground")} />
              <span className="min-w-0">
                <span className="block text-sm font-semibold text-foreground">{ROLE_LABELS[role]}</span>
                <span className="block text-xs leading-snug text-muted-foreground">{ROLE_DESCRIPTIONS[role]}</span>
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function PasswordInput({
  id,
  value,
  onChange,
  placeholder,
}: {
  id: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  const [visible, setVisible] = useState(false);
  return (
    <div className="flex gap-2">
      <div className="relative flex-1">
        <Input
          id={id}
          type={visible ? "text" : "password"}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          autoComplete="new-password"
          className="pr-9 font-mono"
        />
        <button
          type="button"
          onClick={() => setVisible((v) => !v)}
          aria-label={visible ? "Ocultar senha" : "Mostrar senha"}
          className="absolute inset-y-0 right-0 flex w-9 items-center justify-center text-muted-foreground hover:text-foreground"
        >
          {visible ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
        </button>
      </div>
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="h-10"
        onClick={() => {
          onChange(generatePassword());
          setVisible(true);
        }}
      >
        <KeyRound />
        Gerar
      </Button>
      <Button
        type="button"
        variant="outline"
        size="icon-sm"
        className="size-10"
        aria-label="Copiar senha"
        disabled={!value}
        onClick={() => navigator.clipboard.writeText(value).then(() => toast.success("Senha copiada"))}
      >
        <Copy />
      </Button>
    </div>
  );
}

// ─── Diálogos ────────────────────────────────────────────────────────────────

function CreateUserDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<AssignableRole>("carousel_creator");
  const [error, setError] = useState<string | null>(null);

  function reset() {
    setFullName("");
    setEmail("");
    setPassword("");
    setRole("carousel_creator");
    setError(null);
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const res = await createUserAction({ fullName, email, password, role });
      if (res.error) {
        setError(res.error);
        return;
      }
      toast.success(`Acesso criado para ${email}`, {
        description: "Envie o e-mail e a senha para a pessoa entrar.",
      });
      onOpenChange(false);
      reset();
      router.refresh();
    });
  }

  return (
    <Dialog open={open} onOpenChange={(o) => { onOpenChange(o); if (!o) reset(); }}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Novo usuário</DialogTitle>
          <DialogDescription>A pessoa entra com este e-mail e senha. Não é enviado e-mail de convite.</DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="flex min-h-0 flex-1 flex-col">
          <DialogBody className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field id="nu-name" label="Nome">
                <Input id="nu-name" value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Maria Silva" autoFocus />
              </Field>
              <Field id="nu-email" label="E-mail">
                <Input
                  id="nu-email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="maria@empresa.com"
                  autoComplete="off"
                  autoCapitalize="none"
                />
              </Field>
            </div>
            <Field id="nu-pass" label="Senha" hint="Mínimo de 8 caracteres.">
              <PasswordInput id="nu-pass" value={password} onChange={setPassword} />
            </Field>
            <RolePicker value={role} onChange={setRole} />
            {error && (
              <p className="rounded-lg border border-tone-red/25 bg-tone-red/12 px-3 py-2 text-xs text-tone-red">{error}</p>
            )}
          </DialogBody>
          <DialogFooter>
            <Button type="button" variant="ghost" size="sm" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" size="sm" disabled={pending}>
              {pending ? <Loader2 className="animate-spin" /> : <UserPlus />}
              Criar acesso
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function EditUserDialog({ user, onClose }: { user: ManagedUser; onClose: () => void }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [fullName, setFullName] = useState(user.fullName ?? "");
  const [role, setRole] = useState<AssignableRole>(
    user.role === "carousel_creator" ? "carousel_creator" : "admin"
  );
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const res = await updateUserAction(user.id, { fullName, role, password });
      if (res.error) {
        setError(res.error);
        return;
      }
      toast.success(password ? "Usuário e senha atualizados" : "Usuário atualizado");
      onClose();
      router.refresh();
    });
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Editar usuário</DialogTitle>
          <DialogDescription>{user.email}</DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="flex min-h-0 flex-1 flex-col">
          <DialogBody className="space-y-4">
            <Field id="eu-name" label="Nome">
              <Input id="eu-name" value={fullName} onChange={(e) => setFullName(e.target.value)} />
            </Field>
            <RolePicker value={role} onChange={setRole} />
            <Field id="eu-pass" label="Nova senha" hint="Deixe em branco para manter a senha atual.">
              <PasswordInput id="eu-pass" value={password} onChange={setPassword} placeholder="••••••••" />
            </Field>
            {error && (
              <p className="rounded-lg border border-tone-red/25 bg-tone-red/12 px-3 py-2 text-xs text-tone-red">{error}</p>
            )}
          </DialogBody>
          <DialogFooter>
            <Button type="button" variant="ghost" size="sm" onClick={onClose}>
              Cancelar
            </Button>
            <Button type="submit" size="sm" disabled={pending}>
              {pending ? <Loader2 className="animate-spin" /> : <Check />}
              Salvar
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ─── Lista ───────────────────────────────────────────────────────────────────

export function UsersManager({ users, selfId }: { users: ManagedUser[]; selfId: string }) {
  const router = useRouter();
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<ManagedUser | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  async function run(id: string, fn: () => Promise<{ error?: string }>, ok: string) {
    setBusyId(id);
    const res = await fn();
    setBusyId(null);
    if (res.error) toast.error(res.error);
    else {
      toast.success(ok);
      router.refresh();
    }
  }

  const counts = users.reduce<Record<string, number>>((acc, u) => {
    acc[u.role] = (acc[u.role] ?? 0) + 1;
    return acc;
  }, {});

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-2">
        {(["super_admin", "admin", "carousel_creator"] as const).map((role) => (
          <Badge key={role} variant={ROLE_BADGE[role]}>
            {ROLE_LABELS[role]} · {counts[role] ?? 0}
          </Badge>
        ))}
        <Button size="sm" className="ml-auto" onClick={() => setCreating(true)}>
          <Plus />
          Novo usuário
        </Button>
      </div>

      <ul className="divide-y divide-border overflow-hidden rounded-2xl border border-border bg-card shadow-[var(--surface-shadow)]">
        {users.map((u) => {
          const Icon = ROLE_ICON[u.role];
          const locked = u.id === selfId || u.role === "super_admin";
          const busy = busyId === u.id;
          return (
            <li
              key={u.id}
              className={cn("flex flex-wrap items-center gap-3 px-4 py-3 sm:flex-nowrap", u.disabled && "opacity-60")}
            >
              <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-muted text-sm font-bold text-muted-foreground">
                {(u.fullName ?? u.email).charAt(0).toUpperCase()}
              </span>
              <div className="min-w-0 flex-1">
                <p className="flex items-center gap-2 truncate text-sm font-semibold text-foreground">
                  {u.fullName ?? u.email.split("@")[0]}
                  {u.id === selfId && <span className="text-xs font-medium text-muted-foreground">(você)</span>}
                </p>
                <p className="truncate text-xs text-muted-foreground">{u.email}</p>
              </div>

              <div className="flex items-center gap-2">
                <Badge variant={ROLE_BADGE[u.role]}>
                  <Icon />
                  {ROLE_LABELS[u.role]}
                </Badge>
                {u.disabled && <Badge variant="red">Desativado</Badge>}
              </div>

              <p className="hidden w-28 shrink-0 text-right text-xs text-muted-foreground md:block" title="Último acesso">
                {formatDate(u.lastSignInAt)}
              </p>

              <div className="flex shrink-0 items-center gap-0.5">
                {busy ? (
                  <Loader2 className="mx-2 size-4 animate-spin text-muted-foreground" />
                ) : locked ? (
                  <span className="px-2 text-xs text-muted-foreground">—</span>
                ) : (
                  <>
                    <Button variant="ghost" size="icon-sm" aria-label={`Editar ${u.email}`} onClick={() => setEditing(u)}>
                      <Pencil />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      aria-label={u.disabled ? `Reativar ${u.email}` : `Desativar ${u.email}`}
                      title={u.disabled ? "Reativar acesso" : "Desativar acesso"}
                      onClick={() =>
                        run(u.id, () => setUserDisabledAction(u.id, !u.disabled), u.disabled ? "Acesso reativado" : "Acesso desativado")
                      }
                    >
                      {u.disabled ? <RotateCcw /> : <Ban />}
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      aria-label={`Excluir ${u.email}`}
                      title="Excluir usuário"
                      onClick={() => {
                        if (!confirm(`Excluir ${u.email}? A pessoa perde o acesso e os dados dela podem ser removidos. Isso não pode ser desfeito.`)) return;
                        run(u.id, () => deleteUserAction(u.id), "Usuário excluído");
                      }}
                    >
                      <Trash2 />
                    </Button>
                  </>
                )}
              </div>
            </li>
          );
        })}
      </ul>

      <CreateUserDialog open={creating} onOpenChange={setCreating} />
      {editing && <EditUserDialog key={editing.id} user={editing} onClose={() => setEditing(null)} />}
    </div>
  );
}
