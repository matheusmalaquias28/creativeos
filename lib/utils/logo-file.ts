/** Validação de arquivo de logo (upload + server). */

export const LOGO_MIME_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
] as const;

export const LOGO_ACCEPT = LOGO_MIME_TYPES.join(",");

export function isSvgLogoFile(file: File): boolean {
  if (file.type === "image/svg+xml") return true;
  return file.name.toLowerCase().endsWith(".svg");
}

export function isAllowedLogoFile(file: File): boolean {
  if (isSvgLogoFile(file)) return false;
  return (LOGO_MIME_TYPES as readonly string[]).includes(file.type);
}
