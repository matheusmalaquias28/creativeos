# Agente de Carrossel

O agente pede um post por API, em três formatos:

| `format` | O que sai | Como é feito |
| --- | --- | --- |
| `carousel` (padrão) | Carrossel com cards 100% em imagem | GPT Image; capa primeiro e usada como referência dos outros cards |
| `single` | Arte única de feed (post simples) | GPT Image, 1 card |
| `tweet` | Carrossel "print de tweet" (foto, nome, @ verificado, texto) | A IA só escreve o texto; o card é desenhado no servidor (`next/og`), igual ao editor do Carrossel Tweet. Texto exato, sem revisão |

O CreativeOS gera os cards, escreve a legenda com hashtags e deixa o post
**aguardando aprovação** na aba **Carrosséis → Agente**
(`/carousel/agente`). **Nada vai para o Instagram sem aprovação.** Ao aprovar, o
carrossel vira um post agendado (ou publicado na hora) e o fluxo de publicação do
Instagram que já existe cuida do resto ([lib/instagram](../instagram/README.md)).

## Fluxo

```
agente ─POST /runs─▶ fila ─▶ plano (GPT: textos, guia de estilo, legenda + hashtags)
                          ─▶ capa (GPT Image medium; logo + referências do perfil)
                          ─▶ demais cards em paralelo (capa + logo como referência)
                          ─▶ cada card: 1080×1350 + JPEG
                          ─▶ revisão do texto (só marca "para revisar"; NUNCA refaz sozinha)
                          ─▶ aguardando aprovação ─▶ [aprovar] ─▶ instagram_posts (agendado)
                                                   └▶ [reprovar] ─▶ motivo volta ao agente
```

- **Consistência:** a capa é gerada primeiro e entra como Imagem 1 dos outros cards.
- **Tweet:** foto do perfil = "Logo do perfil do Instagram" do perfil de design
  (ou a logo normal), nome do perfil e o @. Fonte Inter (baixada do Google Fonts
  e guardada em memória); se falhar, cai na Noto Sans do `next/og`.
- **Logo:** vai como imagem de referência e a IA aplica na arte, no canto superior
  esquerdo, sem o fundo branco do arquivo. Pode sair com uma leve diferença do
  original. (Antes era colada por cima, e logos com fundo branco ficavam com um
  retângulo branco.)
- **Texto:** regras fixas dos prompts de arte ("A IMAGEM DEVE CONTER SOMENTE ESSES
  TEXTOS, NADA MAIS:" e CTA como botão centralizado embaixo). A revisão por visão
  ignora a logo e só marca o card "para revisar"; refazer é decisão humana.

## Freios de gasto (`limits.ts`)

| Freio | Padrão | Onde muda |
| --- | --- | --- |
| Imagens por 24h (janela móvel), todas as contas | 40 | `CAROUSEL_AGENT_DAILY_IMAGE_LIMIT` |
| Pedidos gerando ao mesmo tempo | 2 | `CAROUSEL_AGENT_MAX_ACTIVE` |
| Tentativas por card | 1 (sem retry automático) | código |
| Tempo por geração | 190s sem começar imagem nova | código |
| Qualidade | `medium` | `CAROUSEL_AGENT_IMAGE_QUALITY` |

- Cada imagem reserva uma vaga no banco **antes** de chamar a API
  (`reserve_carousel_agent_image`, atômico). Sem vaga, o card falha com
  "Limite diário de imagens" e nada é gasto.
- Pedido novo, refazer e retomar são recusados com **429** quando já há pedidos
  demais gerando ou quando o teto do dia não comporta as imagens do pedido.
- O carrossel tweet não gera imagem e não entra no teto.
- A aba mostra quantas imagens já foram usadas nas últimas 24h.
- **Conta:** sai do @ do perfil de design. Precisa ser uma conta conectada nas
  variáveis `INSTAGRAM_ACCESS_TOKEN*`. Se não for, o pedido é recusado na hora.
- **Tempo:** a geração roda em `after()` com teto de 300s. Se a função morrer no
  meio, o carrossel aparece como "Parou no meio" e **Retomar geração** continua
  só os cards que faltaram.

## API (para o agente)

Base: `https://creative.energymidia.com.br`. Todas as chamadas usam
`Authorization: Bearer <CAROUSEL_AGENT_SECRET>`.

### `POST /api/carousel-agent/runs`: pedir um carrossel

```json
{
  "instagram": "@previtasbrasil_",
  "content": "5 erros que fazem o INSS negar a aposentadoria",
  "mode": "ai",
  "cardCount": 6,
  "scheduledAt": "2026-11-20T18:00:00-03:00",
  "externalRef": "id-do-lado-do-agente",
  "callbackUrl": "https://seu-agente/webhooks/carrossel"
}
```

| Campo | Obrigatório | O que é |
| --- | --- | --- |
| `instagram` ou `profileId` | um dos dois | `@` do perfil de design (Carrosséis → Perfis) ou o id dele. |
| `format` | não | `"carousel"` (padrão), `"single"` ou `"tweet"`. |
| `content` | sim | Tema (`mode: "ai"`) ou o texto pronto (`mode: "manual"`, a IA só divide em cards, sem reescrever). Até 20 mil caracteres. |
| `theme` | não | Só no `tweet`: `"light"` (padrão) ou `"dark"`. |
| `mode` | não | `"ai"` (padrão) ou `"manual"`. |
| `cardCount` | não | 2 a 10. Sem isso, a IA decide. Ignorado no `single`. |
| `scheduledAt` | não | ISO 8601 com fuso. Horário sugerido do post; quem aprova confirma ou troca. |
| `externalRef` | não | Volta igual nas respostas e no callback. |
| `callbackUrl` | não | HTTPS. Recebe os avisos de status (abaixo). |

Resposta `202` com o carrossel (`id`, `status: "queued"`, ...). Erros: `400`
(pedido inválido), `401` (segredo), `404` (perfil), `409` (dois perfis com o
mesmo @), `422` (perfil sem @ ou conta não conectada).

**429** (limite de gasto): já há pedidos demais gerando ou o teto diário de imagens
não comporta o pedido. Espere alguns minutos (ou peça um `tweet`, que não gasta
imagem). Não reenvie em loop.

### `GET /api/carousel-agent/runs/{id}`: status

```json
{
  "id": "…",
  "status": "awaiting_approval",
  "title": "5 erros que fazem o INSS negar",
  "profile": "Previtas | Conteúdo orgânico",
  "instagram": "@previtasbrasil_",
  "scheduledAt": "2026-11-20T21:00:00.000Z",
  "caption": "…\n\n#inss #aposentadoria",
  "cards": [{ "index": 0, "status": "ready", "url": "https://…/card-01.jpg", "qaOk": true }],
  "error": null,
  "feedback": null,
  "instagramPostId": null,
  "externalRef": "…",
  "reviewUrl": "https://…/carousel/agente"
}
```

`status`: `queued` → `generating` → `awaiting_approval` → `approved` | `rejected`.
`failed` quando a geração não terminou (`error` diz o motivo).

`GET /api/carousel-agent/runs?limit=20` lista os últimos.

### `POST /api/carousel-agent/runs/{id}/regenerate`

`{}` retoma uma geração que falhou ou parou. `{ "cardIndex": 2, "instruction": "título maior" }`
refaz um card (no `tweet`, a IA reescreve o texto daquele card e ele é desenhado de novo).
Não funciona depois de aprovado ou reprovado.

### Callback

Se o pedido tiver `callbackUrl`, o CreativeOS faz `POST` nela quando o status vira
`awaiting_approval`, `approved`, `rejected` ou `failed`:

```json
{ "event": "rejected", "run": { "...": "mesmo formato do GET" } }
```

Header `x-creativeos-signature: sha256=<hex>`: HMAC-SHA256 do corpo cru com o
`CAROUSEL_AGENT_SECRET`. Confira antes de confiar. Na reprovação, `run.feedback`
traz o motivo para o agente refazer com um novo pedido.

**Aprovar e reprovar são só pela tela**, por um admin logado. O agente não
aprova o próprio carrossel.

## Variáveis

| Variável | Onde | Para quê |
| --- | --- | --- |
| `CAROUSEL_AGENT_SECRET` | Vercel + agente | Autentica o agente e assina o callback. |
| `INSTAGRAM_CRON_SECRET` | Vercel + Vault (`instagram_publish_secret`) | Cron que publica os agendados a cada 5 min (pg_cron). |
| `CREATIVEOS_APP_URL` | Vercel | Link `reviewUrl` nas respostas. |
| `CAROUSEL_AGENT_IMAGE_QUALITY` | opcional | `low`/`medium`/`high` (padrão `medium`). |
| `CAROUSEL_AGENT_DAILY_IMAGE_LIMIT` | opcional | Imagens por 24h (padrão 40). |
| `CAROUSEL_AGENT_MAX_ACTIVE` | opcional | Pedidos gerando ao mesmo tempo (padrão 2). |

## Arquivos

| Arquivo | O que faz |
| --- | --- |
| `pipeline.ts` | Geração: plano, capa, cards em paralelo, revisão, retomada. |
| `prompts.ts` | Prompts do plano e de cada card, legenda + hashtags (puros, testados). |
| `qa.ts` | Revisão do texto de cada card com modelo de visão. |
| `images.ts` | 1080×1350 e JPEG do feed. |
| `limits.ts` | Teto diário de imagens, pedidos simultâneos, tempo por geração. |
| `tweet-render.tsx` / `tweet-layout.ts` | Card tweet desenhado no servidor e o cálculo do tamanho da fonte. |
| `decide.ts` | Aprovar (vira `instagram_posts`) e reprovar. |
| `runs.ts` | Banco, conta pelo @ do perfil, resposta pública e callback. |
| `request.ts` / `auth.ts` | Validação do pedido e autenticação do agente. |
