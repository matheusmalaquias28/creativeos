# Pipeline de Geração de Artes — CreativeOS

## Visão geral

O pipeline substitui a cópia manual de prompts na interface web do Freepik/Magnific por geração via API do Google Gemini (modelo de imagem), em lote, com revisão e ajuste por instrução dentro do próprio CreativeOS.

**Volume-alvo:** ~8 demandas/dia × até 5 artes = ~40 artes/dia.

---

## Fluxo ponta a ponta

```
Demanda chega (webhook Make)
        │
        ▼
[Página da demanda] → botão "Curadoria de artes"
        │
        ▼
POST /api/art-gen/queue { demandId }
  ├─ Cria N linhas art_generation_job (status=queued)
  └─ Dispara runWorker(demandId)
        │
        ▼ (para cada job, concorrência limitada via p-limit)
[Worker]
  1. status → processing
  2. compilePrompt(profile, briefing, artSpec) → prompt_final
  3. Baixa referências de estilo do Storage → inlineData parts
  4. generateArt(prompt, refs) → base64 (síncrono, ~2-5s)
  5. Se logo_mode=composite → compositeLogoPng(art, logo)
  6. Upload PNG → Supabase Storage (bucket: art-generations)
  7. Insere art_version v1 (is_current=true)
  8. status → succeeded (ou failed + error)
        │
        ▼
Frontend recebe updates via Supabase Realtime
(tabelas art_generation_job e art_version publicadas em supabase_realtime)
        │
        ▼
Operador: revisa grid, ajusta inline, aprova, baixa
```

---

## Decisão: geração SÍNCRONA (sem webhook / sem polling)

O modelo `gemini-2.0-flash-preview-image-generation` retorna a imagem diretamente na resposta `generateContent()`, em ~2-5s. **Não há task_id, webhook nem fila assíncrona externa.**

Consequências:
- O worker bloqueia a request HTTP até concluir todos os jobs da demanda.
- Para Next.js (Vercel/Serverless), o timeout padrão pode ser atingido com lotes grandes. Em VPS (sem timeout), funciona sem ajustes.
- Para serverless com muitas artes, use `skipGenerate=true` na queue e dispare o worker de um cron externo.

---

## Ajuste por instrução (chat multi-turn)

`POST /api/art-gen/[jobId]/adjust { instruction }`

Usa `client.chats.create()` do SDK `@google/genai`. O SDK gerencia automaticamente as **thought signatures** entre turnos — necessário para que o modelo entenda o contexto da imagem anterior. Chamadas REST cruas exigiriam gerenciar as signatures manualmente, o que quebra facilmente.

Cada ajuste cria uma nova `art_version` (não sobrescreve). O histórico é preservado. O operador pode reverter via `POST /api/art-gen/[jobId]/versions/[versionId]/restore`.

---

## Estratégias de logo

| Modo | Comportamento |
|---|---|
| `composite` (padrão) | Modelo gera arte sem logo; sistema sobrepõe o PNG original via `sharp`. Determinístico, sempre nítido. |
| `reference` | Logo é passado como `inlineData` para o modelo. Mais natural, mas sem garantia pixel-perfect. |

Configurável por cliente em `client_creative_profile.logo_mode`.

---

## Variáveis de ambiente

| Variável | Descrição |
|---|---|
| `GEMINI_API_KEY` | Chave da API Google Gemini (obrigatória) |
| `IMAGE_MODEL` | ID do modelo (default: `gemini-2.0-flash-preview-image-generation` / Nano Banana Pro 2) |
| `IMAGE_MAX_CONCURRENCY` | Jobs paralelos no worker (default: `3`) |
| `IMAGE_JOB_TIMEOUT_MS` | Timeout por job em ms (default: `120000` = 2min). Evita consumo de créditos em caso de travamento. |
| `ART_GEN_SECRET` | Bearer token para proteger `/api/art-gen/queue` (opcional) |

---

## Nota: SynthID (marca d'água invisível)

Toda imagem gerada pelo Gemini inclui **SynthID**, uma marca d'água criptográfica invisível ao olho humano, embutida pelo Google. Isso é relevante para uso comercial — **validar com o jurídico e com os clientes** antes de entregar as artes geradas via API. Não é bloqueante para o funcionamento do pipeline, mas precisa estar documentado e comunicado.

---

## Nota: Batch API (evolução futura)

Para volume alto e não-urgente (pré-gerar o lote do dia seguinte durante a madrugada), a **Batch API** do Gemini oferece maior rate limit com prazo de até 24h e custo potencialmente menor. Não implementado nesta versão. Registrar como backlog quando o volume escalar além de ~200 artes/dia.

---

## Custo estimado

| Resolução | Custo por arte | 40 artes/dia | 1.200 artes/mês |
|---|---|---|---|
| 1K | ~$0,034 | ~$1,36/dia | ~$40,80/mês |
| 2K (padrão) | ~$0,134 | ~$5,36/dia | ~$160,80/mês |
| 4K | ~$0,534 | ~$21,36/dia | ~$640,80/mês |

*Valores aproximados baseados no pricing público do Gemini em 2026-06. Valide contra o plano contratado e o uso real via Google Cloud Console.*

---

## Arquitetura de arquivos

```
lib/ai/imagegen/
  client.ts          — SDK Gemini: generateArt() + createArtEditSession() + editArtInSession()
  storage-refs.ts    — Download de URLs do Storage → InlineDataPart
  logo-composite.ts  — Composição de logo com sharp
  prompt-compiler.ts — compilePrompt() determinístico
  worker.ts          — runWorker() com p-limit

app/api/art-gen/
  queue/route.ts                              — POST: cria jobs + dispara worker
  [jobId]/approve/route.ts                    — POST: marca job como aprovado
  [jobId]/adjust/route.ts                     — POST: ajuste por instrução (multi-turn)
  [jobId]/versions/[versionId]/restore/route.ts — POST: restaura versão anterior

services/art-gen.ts  — queries Supabase (getJobsForDemand, getCreativeProfile, etc.)

components/art-gen/
  art-card.tsx           — Card com thumbnail, ações, painel inline expansível
  art-curation-grid.tsx  — Grid com Supabase Realtime
  art-status-badge.tsx   — Badge de status visual
  art-version-strip.tsx  — Miniaturas de versões anteriores
  generate-arts-button.tsx — Botão que dispara a queue

supabase/migrations/
  20260617000000_client_creative_profile.sql
  20260617100000_art_generation_job.sql
  20260617200000_art_version.sql
```
