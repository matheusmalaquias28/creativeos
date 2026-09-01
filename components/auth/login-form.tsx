"use client";

import { useActionState } from "react";
import Link from "next/link";
import { signIn, type AuthActionState } from "@/actions/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Surface,
  SurfaceContent,
  SurfaceDescription,
  SurfaceHeader,
  SurfaceTitle,
} from "@/components/ui/surface";

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
      <div className="space-y-2 text-center sm:text-left">
        <h1 className="text-2xl font-medium tracking-heading">Bem-vindo</h1>
        <p className="text-subtitle">
          Acesse o workspace da agência para gerenciar clientes e Creative
          Brains.
        </p>
      </div>

      <Surface variant="elevated">
        <SurfaceHeader>
          <SurfaceTitle>Entrar</SurfaceTitle>
          <SurfaceDescription>
            Use suas credenciais internas da plataforma
          </SurfaceDescription>
        </SurfaceHeader>
        <SurfaceContent>
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
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Senha</Label>
              <Input
                id="password"
                name="password"
                type="password"
                required
                autoComplete="current-password"
              />
            </div>
            {signInState.error && (
              <p className="text-sm text-destructive">{signInState.error}</p>
            )}
            <Button type="submit" className="w-full" disabled={signInPending}>
              {signInPending ? "Entrando..." : "Entrar"}
            </Button>
          </form>
        </SurfaceContent>
      </Surface>

      <p className="text-center text-xs text-muted-foreground/80">
        Uso interno da agência.{" "}
        <Link
          href="/"
          className="text-foreground/70 underline-offset-4 transition-premium hover:text-foreground hover:underline"
        >
          Voltar
        </Link>
      </p>
    </div>
  );
}
