export function extractDriveFolderId(url: string): string | null {
  const trimmed = url.trim();
  if (!trimmed) return null;

  const patterns = [
    /\/folders\/([a-zA-Z0-9_-]{10,})/,
    /[?&]id=([a-zA-Z0-9_-]{10,})/,
    /\/drive\/u\/\d+\/folders\/([a-zA-Z0-9_-]{10,})/,
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
  return [
    params.storedUrl,
    params.briefing?.driveMateriais,
    params.briefing?.materiaisEditados,
    ...(params.artes ?? []).map((arte) => arte.linkReferencias),
  ];
}

export function resolveDemandDriveFolder(urls: Array<string | null | undefined>): {
  url: string | null;
  id: string | null;
} {
  for (const url of urls) {
    if (!url?.trim()) continue;
    const id = extractDriveFolderId(url);
    if (id) return { url: url.trim(), id };
  }

  const first = urls.find((url) => url?.trim() && url.trim() !== "--");
  return { url: first?.trim() ?? null, id: null };
}
