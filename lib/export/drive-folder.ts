/** Hosts do Google Drive/Docs — únicos que representam uma pasta de materiais real. */
function isGoogleDriveHost(host: string): boolean {
  return /(^|\.)google\.com$/i.test(host);
}

/** True quando a URL aponta para o Google Drive (independente de ter pasta válida). */
export function isGoogleDriveUrl(url: string | null | undefined): boolean {
  const trimmed = url?.trim();
  if (!trimmed) return false;
  try {
    return isGoogleDriveHost(new URL(trimmed).hostname);
  } catch {
    return false;
  }
}

/**
 * Extrai o ID de uma pasta do Google Drive. Só reconhece URLs do próprio Google
 * Drive: o campo `linkReferencias` do WAR é sobrecarregado e frequentemente traz
 * referências que NÃO são a pasta de entrega (ex.: Facebook Ads Library
 * `.../ads/library/?id=123`, Pinterest `pin.it`). Sem essa checagem de host, o
 * padrão `?id=` casava com qualquer URL que tivesse `id=` e um anúncio do
 * Facebook virava "pasta do Drive".
 */
export function extractDriveFolderId(url: string): string | null {
  const trimmed = url.trim();
  if (!trimmed) return null;

  let host = "";
  try {
    host = new URL(trimmed).hostname;
  } catch {
    // URLs relativas/malformadas não têm host — tratamos como não-Drive.
    host = "";
  }
  if (!isGoogleDriveHost(host)) return null;

  const patterns = [
    /\/folders\/([a-zA-Z0-9_-]{10,})/,
    /[?&]id=([a-zA-Z0-9_-]{10,})/,
  ];

  for (const pattern of patterns) {
    const match = trimmed.match(pattern);
    if (match?.[1]) return match[1];
  }

  return null;
}

export function collectDemandDriveUrls(params: {
  storedUrl?: string | null;
  briefing?: { driveMateriais?: string; materiaisEditados?: string } | null;
  artes?: Array<{ linkReferencias?: string | null }> | null;
}): Array<string | null | undefined> {
  // `materiaisEditados` é a pasta de entrega e sempre vence `driveMateriais` (a
  // pasta geral/bruta do cliente) quando ambas estão presentes — a demanda quase
  // sempre traz os dois links, mas só o de Materiais Editados é o destino certo
  // para as artes finalizadas. Ver `isMateriaisEditadosMissing` para o alerta
  // quando esse link não vem preenchido.
  return [
    params.storedUrl,
    params.briefing?.materiaisEditados,
    params.briefing?.driveMateriais,
    ...(params.artes ?? []).map((arte) => arte.linkReferencias),
  ];
}

/** True quando a demanda não trouxe o link de Materiais Editados — a entrega não
 * deve cair silenciosamente na pasta geral (`driveMateriais`) nesse caso. */
export function isMateriaisEditadosMissing(
  briefing?: { materiaisEditados?: string } | null
): boolean {
  return !briefing?.materiaisEditados?.trim();
}

export function resolveDemandDriveFolder(urls: Array<string | null | undefined>): {
  url: string | null;
  id: string | null;
} {
  // A "pasta do Drive" é o destino de entrega das artes, então só aceitamos uma
  // pasta do Google Drive de verdade (com ID extraível). Varremos TODOS os
  // candidatos para que uma referência (Facebook/Pinterest) ou um arquivo avulso
  // (`/file/d/...`) numa arte anterior não "roube" a pasta real que aparece numa
  // arte posterior. Sem pasta válida, devolvemos nulo em vez de promover um link
  // de referência a "pasta do Drive".
  for (const url of urls) {
    if (!url?.trim()) continue;
    const id = extractDriveFolderId(url);
    if (id) return { url: url.trim(), id };
  }

  return { url: null, id: null };
}
