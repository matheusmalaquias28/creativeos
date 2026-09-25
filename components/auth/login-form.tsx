"use client";

import { useActionState } from "react";
import Link from "next/link";
import { signIn, type AuthActionState } from "@/actions/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const initialState: AuthActionState = {};

type LoginFormProps = {
  redirectTo?: string;
};

export function LoginForm({ redirectTo }: LoginFormProps) {
  const [signInState, signInAction, signInPending] = useActionState(
    signIn,
    initialState
  );

  return (
    <div className="space-y-8">
      <div className="space-y-2">
        <h1 className="text-[1.75rem] font-bold tracking-[-0.03em]">Bem-vindo de volta</h1>
        <p className="text-subtitle">
          Entre com suas credenciais internas para acessar o workspace.
        </p>
      </div>

      <form action={signInAction} className="space-y-5">
        {redirectTo && (
          <input type="hidden" name="redirectTo" value={redirectTo} />
        )}
        <div className="space-y-2">
          <Label htmlFor="email">E-mail</Label>
          <Input
            id="email"
            name="email"
            type="email"
            placeholder="voce@agencia.com"
            required
            autoComplete="email"
            className="h-11"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="password">Senha</Label>
          <Input
            id="password"
            name="password"
            type="password"
            placeholder="••••••••"
            required
            autoComplete="current-password"
            className="h-11"
          />
        </div>
        {signInState.error && (
          <p className="rounded-xl border border-tone-red/25 bg-tone-red/10 px-3.5 py-2.5 text-sm text-tone-red">
            {signInState.error}
          </p>
        )}
        <Button type="submit" size="lg" className="w-full" disabled={signInPending}>
          {signInPending ? "Entrando..." : "Entrar"}
        </Button>
      </form>

      <p className="text-center text-xs text-muted-foreground">
        Uso interno da agência.{" "}
        <Link
          href="/"
          className="font-semibold text-foreground/80 underline-offset-4 transition-premium hover:text-foreground hover:underline"
        >
          Voltar ao início
        </Link>
      </p>
    </div>
  );
}
