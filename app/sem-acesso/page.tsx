import { ShieldOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { signOut } from "@/actions/auth";

export default function SemAcessoPage() {
  return (
    <div className="flex min-h-screen items-center justify-center p-6">
      <div className="max-w-sm space-y-4 text-center">
        <span className="mx-auto flex size-12 items-center justify-center rounded-2xl bg-tone-amber/12 text-tone-amber">
          <ShieldOff className="size-5" />
        </span>
        <h1 className="text-lg font-bold tracking-tight text-foreground">Sua conta ainda não tem acesso</h1>
        <p className="text-sm text-muted-foreground">
          Peça ao administrador para liberar as permissões do seu usuário.
        </p>
        <form action={signOut}>
          <Button type="submit" variant="outline" size="sm">
            Sair
          </Button>
        </form>
      </div>
    </div>
  );
}
