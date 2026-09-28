import { redirect } from "next/navigation";

/**
 * A tela de referências virou o passo 3 do cadastro.
 *
 * Ela existia com três uploads que gravavam em tabelas diferentes — acervo de
 * IA, referências legadas do Creative Brain e fotos do cliente — e só o acervo
 * contava para a prontidão. Manter a rota como redirect preserva os links
 * antigos (e-mails, favoritos, cards) sem manter a duplicação na tela.
 */
export default async function ReferencesPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  redirect(`/clients/${id}/onboarding`);
}
