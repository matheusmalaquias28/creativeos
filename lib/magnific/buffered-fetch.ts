/**
 * fetch que bufferiza o corpo inteiro da resposta antes de devolvê-la. Usado só no
 * handshake OAuth (discovery/DCR/token exchange) — essas respostas nunca são stream.
 * Sem isso, uma resposta cujo corpo não é totalmente consumido pode deixar a conexão
 * keep-alive presa no pool do undici, travando a PRÓXIMA requisição pro mesmo host.
 */
export function createBufferedFetch(logPrefix: string): typeof fetch {
  return async (input, init) => {
    const url = typeof input === "string" ? input : input.toString();
    const method = init?.method ?? "GET";
    const t0 = Date.now();
    console.log(`${logPrefix} fetch -> ${method} ${url}`);
    try {
      const response = await fetch(input, init);
      const buffer = await response.arrayBuffer();
      console.log(`${logPrefix} fetch <- ${method} ${url} status=${response.status} ${Date.now() - t0}ms`);
      return new Response(buffer, {
        status: response.status,
        statusText: response.statusText,
        headers: response.headers,
      });
    } catch (fetchError) {
      console.log(
        `${logPrefix} fetch !! ${method} ${url} ${Date.now() - t0}ms`,
        fetchError instanceof Error ? fetchError.message : fetchError
      );
      throw fetchError;
    }
  };
}
