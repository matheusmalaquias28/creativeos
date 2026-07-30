import { MagnificMcpSession, MagnificToolError } from "@/lib/magnific/mcp-client";
import { firstString } from "@/lib/magnific/extract";
import { parseSpaceStateNodes } from "@/lib/magnific/space-state";
import type { MagnificSpaceNode } from "@/types/demand";
import type { MvpPage, MvpReference } from "@/types/mvp";
import { buildMvpSpaceQueryBatches, type MvpReferenceMention } from "./build-mvp-query";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const ADD_CREATIONS_BATCH = 20;
const EDIT_WAIT_TIMEOUT_SECONDS = 25;
// Teto de polling POR LOTE de spaces_edit (~2,5 min). O spaces_edit limita a
// query a ~4000 chars, então MVPs grandes viram vários lotes sequenciais — o
// timeout externo de 5 min em trigger-generation.ts é quem corta o total.
const MAX_EDIT_WAIT_CALLS = 6;

export class MvpGenerationError extends Error {
  constructor(
    public readonly step: string,
    message: string
  ) {
    super(`[${step}] ${message}`);
    this.name = "MvpGenerationError";
  }
}

export type GenerateMvpSpaceInput = {
  projectId: string;
  title: string;
  logoUrl: string | null;
  referenceUrls: MvpReference[];
  /** páginas deste lote (a geração roda de 10 em 10 páginas) */
  pages: MvpPage[];
  /** Space já criado por um lote anterior — reutilizado para acumular os nodes */
  existingSpace: { spaceId: string; spaceUrl: string } | null;
};

export type GenerateMvpSpaceResult = {
  spaceId: string;
  spaceUrl: string;
  nodes: MagnificSpaceNode[];
};

function spaceWebUrl(spaceId: string): string {
  return `https://www.magnific.com/app/spaces/${spaceId}`;
}

async function assertMagnificCredits(
  session: MagnificMcpSession,
  signal?: AbortSignal
): Promise<void> {
  let balance: unknown;
  try {
    balance = await session.callTool("account_balance", {}, signal);
  } catch (err) {
    console.warn(
      "[mvp/generate-space] account_balance falhou — seguindo sem pre-check:",
      err instanceof Error ? err.message : err
    );
    return;
  }

  const parsed = balance as {
    plan?: { isUnlimitedMode?: boolean; unlimitedAppliesHere?: boolean; name?: string };
    credits?: { available?: number };
  };

  // Se tem qualquer plano ativo ou modo ilimitado, libera.
  if (
    parsed?.plan?.isUnlimitedMode ||
    parsed?.plan?.unlimitedAppliesHere ||
    parsed?.plan?.name
  )
    return;

  const available = parsed?.credits?.available;
  // Só bloqueia se explicitamente zero E sem nenhum plano identificado.
  if (typeof available === "number" && available <= 0) {
    throw new MvpGenerationError(
      "account_balance",
      "Conta Magnific sem créditos disponíveis — a edição do Space seria cobrada e falharia."
    );
  }
}

async function addCreationsInBatches(
  session: MagnificMcpSession,
  spaceId: string,
  identifiers: string[],
  signal?: AbortSignal
): Promise<void> {
  for (let i = 0; i < identifiers.length; i += ADD_CREATIONS_BATCH) {
    await session.callTool(
      "spaces_add_creations",
      { spaceId, creationIdentifiers: identifiers.slice(i, i + ADD_CREATIONS_BATCH) },
      signal
    );
  }
}

/**
 * Gera o Space do MVP direto via MCP do Magnific (sem agente Claude):
 *
 *   1. cria um Space novo com o nome do MVP
 *   2. sobe logo + referências de cada página (creations_upload_image)
 *   3. dispara um spaces_edit único descrevendo um node de geração por página,
 *      com as referências da página conectadas em cada node
 *   4. espera terminar (spaces_edit_status até allTerminal) e tira snapshot dos nós
 *
 * Diferente do Space de demanda, o MVP sempre cria um Space próprio — cada MVP
 * é um produto fechado, não faz sentido reaproveitar board entre projetos.
 */
export async function generateMvpSpace(
  input: GenerateMvpSpaceInput,
  opts: { signal?: AbortSignal } = {}
): Promise<GenerateMvpSpaceResult> {
  const { signal } = opts;
  const spaceName = `MVP — ${input.title}`;

  let step = "connect";
  try {
    const session = await MagnificMcpSession.connect(signal);

    step = "account_balance";
    await assertMagnificCredits(session, signal);

    let spaceId: string;
    let spaceUrl: string;
    if (input.existingSpace) {
      ({ spaceId, spaceUrl } = input.existingSpace);
    } else {
      step = "spaces_create";
      const created = await session.callTool("spaces_create", { name: spaceName }, signal);
      const spaceIdCandidates = [
        firstString(created, ["spaceId"]),
        firstString(created, ["id"]),
      ].filter((c): c is string => !!c);
      const foundId = spaceIdCandidates.find((c) => UUID_RE.test(c));
      if (!foundId) {
        throw new MvpGenerationError(
          "spaces_create",
          `resposta sem UUID de space — ${JSON.stringify(created).slice(0, 300)}`
        );
      }
      spaceId = foundId;
      spaceUrl = firstString(created, ["webUrl"]) ?? spaceWebUrl(spaceId);
    }

    // Upload da logo + referências por página. Cada upload devolve um creation
    // identifier — é ele que vira menção @[id:Label:output] no prompt do edit.
    step = "upload-references";
    const identifiers: string[] = [];
    let logoIdentifier: string | null = null;
    const references: MvpReferenceMention[] = [];

    if (input.logoUrl) {
      const uploaded = await session.callTool(
        "creations_upload_image",
        { url: input.logoUrl },
        signal
      );
      logoIdentifier = firstString(uploaded, ["identifier", "creationIdentifier"]) ?? null;
      if (logoIdentifier) identifiers.push(logoIdentifier);
      else console.warn(`[mvp/generate-space] upload da logo sem identifier: ${input.logoUrl}`);
    }

    const seen = new Set<string>();
    for (const [refIndex, ref] of input.referenceUrls.entries()) {
      if (seen.has(ref.url)) continue;
      seen.add(ref.url);
      const uploaded = await session.callTool(
        "creations_upload_image",
        { url: ref.url },
        signal
      );
      const id = firstString(uploaded, ["identifier", "creationIdentifier"]);
      if (!id) {
        console.warn(`[mvp/generate-space] upload sem identifier: ${ref.url}`);
        continue;
      }
      identifiers.push(id);
      references.push({ identifier: id, label: `Ref ${refIndex + 1}` });
    }

    step = "spaces_add_creations";
    await addCreationsInBatches(session, spaceId, identifiers, signal);

    // Edições em lotes sequenciais: cada lote cria os nodes de um grupo de
    // páginas (limite de ~4000 chars por query). Espera cada lote terminar
    // antes do próximo para o agente do Magnific ver os nodes anteriores e
    // manter a identidade visual.
    const queries = buildMvpSpaceQueryBatches(input.pages, logoIdentifier, references, {
      isContinuation: input.existingSpace !== null,
    });
    for (const [batchIndex, query] of queries.entries()) {
      step = `spaces_edit (lote ${batchIndex + 1}/${queries.length})`;
      const edit = await session.callTool(
        "spaces_edit",
        {
          spaceId,
          query: `${query} IMPORTANTE: NÃO renomeie este Space — o nome dele deve permanecer exatamente "${spaceName}".`,
        },
        signal
      );
      const operationId = firstString(edit, [
        "operationId",
        "operation_id",
        "threadId",
        "thread_id",
      ]);

      if (!operationId) {
        console.warn(
          `[mvp/generate-space] spaces_edit (lote ${batchIndex + 1}) sem operationId — sem como acompanhar; seguindo`
        );
        continue;
      }

      let terminal = false;
      for (let i = 0; i < MAX_EDIT_WAIT_CALLS && !terminal; i++) {
        const status = await session.callTool(
          "spaces_edit_status",
          { operationId, timeoutSeconds: EDIT_WAIT_TIMEOUT_SECONDS },
          signal
        );
        const raw = JSON.stringify(status);
        terminal = raw.includes('"allTerminal":true') || /allTerminal:\s*true/.test(raw);
        const failed = firstString(status, ["status", "state"]);
        if (failed && /^(failed|error)$/i.test(failed)) {
          throw new MvpGenerationError(
            step,
            firstString(status, ["error", "errorMessage"]) ?? `edição falhou (${failed})`
          );
        }
      }
      if (!terminal) {
        console.warn(
          `[mvp/generate-space] lote ${batchIndex + 1}/${queries.length} não terminou dentro do teto de polling — seguindo`
        );
      }
    }

    step = "spaces_state";
    let nodes: MagnificSpaceNode[] = [];
    try {
      const state = await session.callTool("spaces_state", { spaceId }, signal);
      nodes = parseSpaceStateNodes(state);
    } catch (err) {
      console.warn(
        "[mvp/generate-space] spaces_state falhou — seguindo sem snapshot dos nós:",
        err instanceof Error ? err.message : err
      );
    }

    return { spaceId, spaceUrl, nodes };
  } catch (error) {
    if (error instanceof MvpGenerationError) throw error;
    const message =
      error instanceof MagnificToolError || error instanceof Error
        ? error.message
        : "Erro desconhecido";
    throw new MvpGenerationError(step, message);
  }
}
