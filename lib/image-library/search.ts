/** Busca local no acervo — o acervo cabe inteiro no client (centenas de itens). */

export type SearchableLibraryImage = {
  ai_description: string | null;
  ai_tags: string[];
  file_name: string | null;
};

export function normalizeSearchText(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

/** Todos os termos da busca precisam aparecer em descrição, tags ou nome do arquivo. */
export function filterLibraryImages<T extends SearchableLibraryImage>(images: T[], query: string): T[] {
  const terms = normalizeSearchText(query).split(/\s+/).filter(Boolean);
  if (terms.length === 0) return images;

  return images.filter((image) => {
    const haystack = normalizeSearchText(
      [image.ai_description ?? "", image.ai_tags.join(" "), image.file_name ?? ""].join(" ")
    );
    return terms.every((term) => haystack.includes(term));
  });
}
