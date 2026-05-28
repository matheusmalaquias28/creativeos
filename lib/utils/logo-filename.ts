/**
 * Nome padrão de arquivo: logo(NomeDoCliente).ext
 */
export function buildLogoFileName(clientName: string, ext: string): string {
  const safeName =
    clientName
      .trim()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-zA-Z0-9]/g, "") || "cliente";

  const safeExt = ext.replace(/[^a-z0-9]/gi, "") || "png";
  return `logo(${safeName}).${safeExt}`;
}

export function buildLogoStoragePath(
  userId: string,
  clientId: string,
  clientName: string,
  ext: string
): string {
  return `${userId}/${clientId}/${buildLogoFileName(clientName, ext)}`;
}
