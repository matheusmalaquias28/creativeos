# Tarefa: pipeline de geração de artes em lote no CreativeOS (Nano Banana Pro)

Você é o Claude Code trabalhando neste repositório (CreativeOS). Implemente o pipeline descrito abaixo. **Antes de escrever qualquer código, leia o estado atual do projeto** — `package.json`, estrutura de pastas, como o servidor HTTP sobe, como o client Supabase é instanciado, como migrations rodam, qual framework de frontend está em uso (Next? Vite+React?) — e **adapte-se ao que já existe**. Não troque frameworks. **Pare e me apresente o plano antes de implementar.**

## Contexto do produto

CreativeOS organiza demandas criativas de uma agência (~200 clientes). Gestores enviam um briefing (a copy). O sistema cria uma "demanda" com até 5 artes. Cada cliente passou por um onboarding criativo prévio com cores, fontes, logo e imagens de referência de estilo. Volume-alvo: ~8 demandas/dia, até 5 artes cada (~40 artes/dia). O operador único gera, **revisa no grid**, ajusta o que precisar e só então entrega. Meta: o trabalho diário caber em ~1-2h, concentrado em julgamento, não em operação manual.

Hoje as artes são feitas copiando o prompt e colando na interface web do Freepik/Magnific. **Esta tarefa elimina esse passo: o CreativeOS passa a gerar via API do Nano Banana Pro (Gemini 3 Pro Image), em lote, com revisão e ajuste por instrução dentro do próprio sistema.**

## Stack confirmada

- Runtime: Node.js + TypeScript.
- Banco + Storage + Realtime: Supabase (Postgres). Use o client `@supabase/supabase-js` já presente. As imagens de referência e os logos dos clientes já moram no Supabase Storage.
- Framework HTTP backend: **detecte pelo `package.json` e siga o que já está em uso.**
- Frontend: dentro do próprio CreativeOS (provavelmente React/Next — **detecte e siga o padrão existente**). Não introduza um framework novo.
- Deploy: VPS/cloud com URL pública.
- Chave do modelo: **já existe em variável de ambiente.** Detecte o nome (provavelmente `GEMINI_API_KEY` ou `GOOGLE_API_KEY`). Nunca logue a chave nem a exponha ao frontend — toda chamada ao modelo é server-side.

## Fatos técnicos do modelo (verificados — não invente)

- SDK oficial: `@google/genai` (JavaScript/TypeScript). **Use o SDK, não chamadas REST cruas** — ver motivo em "ajuste por instrução" abaixo.
- Modelo principal: `gemini-3-pro-image` (Nano Banana Pro), para produção profissional, texto de alta fidelidade e raciocínio em prompts complexos. Para iterações rápidas/baratas existe `gemini-3.1-flash-image` (Nano Banana 2) — deixe o modelo configurável por env (`IMAGE_MODEL`, default `gemini-3-pro-image`).
- **A geração é SÍNCRONA.** `client.models.generateContent(...)` retorna a imagem na própria resposta, como base64 (`part.inlineData.data`), em ~2-5s. **NÃO há task_id, webhook, nem polling.** Não construa endpoint de webhook nem cron de reconciliação — não se aplica a este modelo.
- Resolução: passe `imageConfig.imageSize` com `"1K"|"2K"|"4K"` (K maiúsculo; minúsculo é rejeitado). Aspect ratio via `imageConfig.aspectRatio` (ex.: `"1:1"`, `"4:5"`, `"16:9"`, `"9:16"`).
- Saída: `responseModalities: ["TEXT","IMAGE"]`. A imagem vem em `response.candidates[0].content.parts[].inlineData` (base64) — decodifique e suba pro Supabase Storage; guarde a URL.
- **Referências de imagem:** o modelo aceita até 14 imagens de referência numa única geração. No `gemini-3-pro-image`: até 6 imagens de objeto em alta fidelidade + até 5 de personagem. Passe cada referência como uma part `inlineData` (base64 do arquivo original lido do Storage — não redimensione, não reconverta). As imagens de estilo do onboarding entram aqui (pode ser mais de uma, ao contrário do Mystic).
- **Logo — duas estratégias, ambas no documento:**
  1. Como referência de alta fidelidade na própria geração (a doc demonstra "coloque este logo no anúncio, perfeitamente integrado"). Mais natural, mas não garante exatidão pixel-perfect.
  2. **Composição posterior com `sharp`** (recomendado como padrão para logo de marca): o modelo gera a arte de fundo/cena com estilo e cor certos; o sistema sobrepõe o arquivo de logo original por cima, em posição/tamanho definidos no perfil do cliente. Determinístico, sempre nítido. Torne a estratégia configurável por cliente (`logo_mode`: `reference` | `composite`), default `composite`.
- **Cores:** descreva a paleta do cliente no texto do prompt em hex (ex.: "paleta dominante: #1A2B3C, #FF8800"). O modelo segue descrição narrativa bem; não há campo estruturado de cor como no Mystic.
- **Marca d'água:** toda imagem gerada inclui SynthID (invisível). Sinalize isso no README como ponto a validar com o jurídico/clientes para uso comercial. Não é bloqueante, mas precisa estar documentado.
- **Batch API** (opcional, nota no README): para volume alto e não-urgente, a Batch API dá rate limit maior com prazo de até 24h — útil para pré-gerar o lote do dia seguinte mais barato. Não implementar agora; só registrar como evolução.

## O que implementar

### 1. Cliente do modelo (`src/services/imagegen/`)
- Módulo tipado encapsulando `generateArt(params)` (texto + N referências em base64 → imagem base64) e `editArt(session, instruction)` (ver item 6).
- Usa o SDK `@google/genai`. Tipos explícitos, sem `any`. Timeout, retry com backoff em 429/5xx, sem vazar a chave em log.
- Função utilitária que recebe URLs do Storage, baixa os bytes originais e monta as parts `inlineData` sem reprocessar a imagem.

### 2. Schema no Supabase (migrations seguindo o padrão do repo)
- `client_creative_profile` — `client_id`, `base_prompt` (estilo/identidade em texto), `palette` (jsonb de hex), `style_reference_urls` (jsonb), `logo_url`, `logo_mode` (`reference`|`composite`, default `composite`), `logo_placement` (jsonb: posição/tamanho/margem para o sharp), `image_size` default, `aspect_ratio` default.
- `art_generation_job` — uma linha por arte: `id`, `demand_id`, `client_id`, `status` (`queued`|`processing`|`succeeded`|`failed`), `prompt_final`, `params` (jsonb), `error`, `attempts`, `created_at`, `updated_at`. (Sem `task_id` — geração é síncrona.)
- `art_version` — versionamento por arte (decisão tomada: manter histórico): `id`, `job_id` (fk), `version_number`, `result_url` (no Storage), `instruction` (a instrução de ajuste que gerou esta versão; null na v1), `is_current` (bool), `created_at`. A v1 é a geração original; cada ajuste cria uma nova versão e move `is_current`. Guardar todas no banco; o frontend exibe só as ~4 mais recentes + a atual.
- A fila é a própria `art_generation_job` com status `queued`. Não introduza Redis/BullMQ a menos que o repo já use.

### 3. Compilação de prompt (`src/services/promptCompiler`)
- `compilePrompt(profile, briefingCopy, artSpec)` → monta `prompt_final` (narrativo, descritivo — a doc enfatiza "descreva a cena, não liste keywords") combinando: `base_prompt` do cliente + a copy do briefing + a paleta em hex embutida no texto + specs da arte (aspect ratio etc.). Determinística e testável.
- Testes unitários: com/sem referências de estilo, logo em modo `reference` vs `composite`, paleta presente/ausente.

### 4. Disparo em lote com fila e concorrência limitada
- Ao criar a demanda: inserir N linhas `art_generation_job` com status `queued`.
- Worker processa a fila com limite de concorrência via env (`IMAGE_MAX_CONCURRENCY`, default conservador ex.: 3), usando um limitador (ex.: `p-limit`). Justificativa: a geração é síncrona e rápida, mas disparar 40 em paralelo estoura rate limit; concorrência limitada é mais segura.
- Por job: marca `processing` → `compilePrompt` → `generateArt` (com as referências) → se `logo_mode=composite`, compõe o logo com `sharp` → sobe o PNG final no Storage → cria `art_version` v1 com `is_current=true` → marca `succeeded` (ou `failed` com erro e incrementa `attempts`).

### 5. Estado e notificação in-app via Supabase Realtime
- O frontend assina `art_generation_job` (e/ou `art_version`) por `demand_id` via Supabase Realtime. Conforme cada job sai de `queued`/`processing`, o grid atualiza a miniatura sozinho. Quando todos os jobs de uma demanda concluem, o sistema sinaliza "lote pronto".
- Garanta políticas RLS corretas para a subscription do frontend. Documente como o frontend assina.

### 6. Ajuste por instrução (o loop de revisão) — usar chat multi-turn do SDK
- Endpoint server-side que recebe `job_id` + `instruction` (texto livre, ex.: "deixe o logo maior e o fundo mais escuro").
- Implementação: usar o recurso de **chat multi-turn do SDK `@google/genai`**, enviando a imagem atual + a instrução. **Motivo crítico:** o modelo exige circular "thought signatures" entre turnos, e o SDK em modo chat trata isso automaticamente. Chamadas REST cruas exigiriam gerenciar as signatures à mão e quebram com facilidade. Por isso o item 1 manda usar o SDK.
- O resultado é uma nova `art_version` (não sobrescreve): incrementa `version_number`, grava a `instruction`, sobe o novo PNG, move `is_current`. Se `logo_mode=composite`, reaplica o logo após a edição.
- O usuário pode reverter para uma versão anterior (apenas move `is_current`) — ajuste nunca destrói trabalho bom.

### 7. Frontend — tela de curadoria no CreativeOS
Siga o framework e os componentes já existentes no projeto. Comportamento:
- **Grid agrupado por cliente e por demanda.** Cada bloco = uma demanda (cliente + nº + contagem de artes). Blocos colapsáveis.
- Cada arte é um card com **estado visível** (gerando / em revisão / aprovada / falhou), vindo de `status` via Realtime. Ações no card: aprovar, regenerar, baixar.
- **Ajuste inline:** ao acionar uma arte, expande um painel **embaixo do próprio card** com a imagem ampliada, um `textarea` para a instrução e botão "aplicar ajuste" (chama o item 6). **Importante de layout:** o card expandido deve ocupar a largura inteira da linha do grid (`grid-column: 1 / -1`) quando aberto, para não deslocar os vizinhos de forma quebrada.
- **Histórico de versões** no painel inline: miniaturas das ~4 versões mais recentes + marca clara de qual é a atual; clicar numa versão antiga a torna a atual.
- **Download:** por arte (card e painel) e em lote por demanda ("baixar aprovadas").

## Requisitos transversais
- TypeScript estrito, sem `any` solto. Trate todos os erros de rede e de geração (inclusive respostas sem parte de imagem).
- Nada de segredos em log. `.env.example` atualizado: `GEMINI_API_KEY` (ou nome detectado), `IMAGE_MODEL`, `IMAGE_MAX_CONCURRENCY`, mais as do Supabase já existentes — cada uma comentada.
- Testes unitários mínimos: `promptCompiler` e a função de composição de logo com `sharp`.
- README na pasta do pipeline: fluxo ponta a ponta, decisão síncrona (sem webhook), nota sobre SynthID/uso comercial, nota sobre Batch API como evolução futura, e custo estimado por arte (≈ $0,134 em 2K) × volume para o operador validar contra o plano.
- Commits pequenos e lógicos.

## Ordem de execução
1. Ler o repo, confirmar stack/convenções (backend e frontend). **Apresentar o plano e parar.**
2. Cliente do modelo + tipos + teste de fumaça (uma geração simples 1K).
3. Migrations (profile, job, version).
4. promptCompiler + composição de logo com sharp + testes.
5. Fila + worker com concorrência limitada (gera → compõe logo → versiona v1).
6. Endpoint de ajuste por instrução (chat multi-turn do SDK) + versionamento.
7. Frontend: grid por cliente, card com estado, ajuste inline (full-row), histórico, downloads + subscription Realtime + notas de RLS.
8. README + `.env.example`.

Comece pelo passo 1 e me mostre o plano antes de codar.