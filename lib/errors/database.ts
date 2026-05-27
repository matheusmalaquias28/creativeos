const SCHEMA_MISSING_PATTERNS = [
  "Could not find the table",
  "schema cache",
  "relation",
  "does not exist",
  "PGRST205",
];

export function isSchemaMissingError(message: string): boolean {
  const lower = message.toLowerCase();
  return SCHEMA_MISSING_PATTERNS.some((p) => lower.includes(p.toLowerCase()));
}

export function schemaNotReadyError(original?: string): Error {
  return new Error(
    [
      "O schema do banco ainda não foi aplicado no Supabase.",
      "Execute: npm run db:setup (com SUPABASE_DB_PASSWORD no .env.local)",
      "Ou rode o arquivo supabase/setup.sql no SQL Editor do dashboard.",
      original ? `\nDetalhe: ${original}` : "",
    ].join(" ")
  );
}
