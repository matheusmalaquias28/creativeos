# Camada de Direção de Arte — CreativeOS

## V2 (atual) — resumo

A curadoria gera **só pelo Gemini, direto** (nada de Magnific). Por arte:

1. **Diretor com visão** (`direct-art.ts`, Claude Opus 5 — `ART_DIRECTOR_VISION_MODEL`):
   vê as referências do acervo (até 10, rotuladas r01…), escolhe UMA como
   **layout mestre** e escreve um briefing de design em inglês (composição em %,
   herói visual, sistema tipográfico com estilos nomeados, cor, acabamento).
   Mestres diferentes entre artes irmãs = variedade. Conceito/diferencial em PT.
2. **Bloco técnico** (`technical-block.ts`): padrões fixos de produto —
   área segura Meta, zona da logo (0–15% da altura, topo central, fundo liso e
   contínuo), CTA sempre botão centralizado com base em ~89%, lista fechada de
   textos com a caixa original, papéis sem título (`sanitizeBrief` troca
   "contract" por "printed pages").
3. **Gemini** gera a arte (Imagem 1 = mestre).
4. **Logo** (`lib/ai/imagegen/brand-logo.ts`): fundo removido, contraste WCAG ≥ 3
   (recolore para a cor escura da paleta ou branco), topo central. Mede a
   uniformidade do fundo sob a logo — se ela atravessa uma borda, a arte refaz.
5. **Revisão com visão** (`review-art.ts`): texto exato, palavras extras, zona da
   logo, CTA, logos inventadas, glifos. Reprovou → UMA nova tentativa com as
   correções (`ART_REVIEW_MAX_ATTEMPTS`, desligável com `ART_REVIEW_ENABLED=0`).
   Resultado salvo em `direction.review`.
6. Salva `vN.png` (final) e `vN_raw.png` (sem logo). Ajustes por instrução editam a
   versão raw e recompõem a logo — ela nunca é redesenhada nem duplicada.

Botão "Gerar artes" da curadoria (`/api/art-gen/queue`): diretor em paralelo com
mestres pré-atribuídos → aprovação automática → worker. Para revisar briefings
antes de gerar, use a página de prompts (`/api/art-gen/prepare`).

Custo aproximado por arte: direção ~US$0,05–0,08 + geração 2K ~US$0,13 +
revisão ~US$0,02 (+ uma geração extra quando a revisão reprova).

---

## Histórico (V1)

Substitui a concatenação determinística de `compilePrompt()` por uma decisão de
direção de arte: escolhe referências do acervo do cliente e escreve uma cena.

**Aditivo por construção.** Nada aqui altera o caminho Magnific Spaces
(`lib/magnific/generate-space.ts`, `magnific_space*`, `client_magnific_space`)
nem o `/api/art-gen/queue` legado — os dois continuam funcionando como estavam.

---

## Fluxo

```
Demanda (webhook Make)
      │
      ▼
POST /api/art-gen/prepare { demandId }
  ├─ valida client_art_readiness (logo, paleta, DNA, 4+ referências)
  ├─ cria N jobs em status 'draft'
  └─ prepareDemandPrompts() — EM SEQUÊNCIA, uma chamada Claude por arte
        │   cada arte recebe os conceitos das irmãs e é obrigada a diferir
        ▼
  enforceDistinctReferenceSets()  ← rede dura de anti-repetição
        │
        ▼
  art_job_reference + prompt_draft, status 'awaiting_approval'
        │
        ▼
/demands/[id]/prompts — operador revisa, edita, regenera com steer
        │
        ▼
POST approve-prompt (ou approve-all) → status 'queued' + bump de usage
        │
        ▼
worker.ts: appendTechnicalBlock(promptAprovado) → Gemini → art_version
        │
        ▼
/demands/[id]/curation — ajuste inline e aprovação da imagem (inalterado)
```

---

## Por que o gate é no prompt

Uma arte 2K no Gemini custa ~$0,134; uma chamada de direção de arte custa ~$0,03.
Revisar antes de gerar é ~4x mais barato por iteração e mais rápido — o operador
lê um parágrafo em vez de esperar a imagem para descobrir que a direção estava
errada. Em 400 artes/mês, é o que segura a conta.

---

## Arquivos

| Arquivo | Responsabilidade |
|---|---|
| `types.ts` | Contratos: papéis, acervo, entrada e saída da direção |
| `system-prompt.ts` | **O ativo real.** Regras anti-AI-slop + schema da tool |
| `catalog.ts` | Acervo → catálogo em texto, com rotação por uso. Puro |
| `direct-art.ts` | A chamada Claude com tool use, retry e resolução de tokens |
| `dedupe.ts` | Nenhuma arte da mesma demanda repete conjunto de referências. Puro |
| `technical-block.ts` | Sufixo determinístico: textos permitidos, CTA-botão, ordem das refs. Puro |
| `prepare.ts` | Orquestração e persistência |

Os quatro módulos puros (`catalog`, `dedupe`, `technical-block`, `types`) têm
testes em `__tests__/` e não fazem I/O — mesma entrada, mesma saída.

---

## Decisões que valem entender antes de mexer

**Catálogo em texto, não imagens.** A anotação por IA no upload
(`lib/ai/annotate-reference.ts`, Haiku, ~$0,002) transforma escolha de referência
em problema de texto: ~800 tokens de catálogo em vez de 40 imagens por chamada.
É também o que permite mostrar `usage_count` ao modelo e pedir rotação.

**Sonnet, não Haiku.** Haiku é o certo para anotar referência e extrair DNA
(descrição). Direção de arte é julgamento composicional, e Haiku volta a
produzir a média do dataset — que é exatamente o problema que esta camada existe
para resolver.

**Artes em sequência, não em paralelo.** `siblings` só funciona se as artes
anteriores já tiverem conceito escrito. ~20s numa demanda de 5. O custo de não
ver 5 variações da mesma ideia.

**`usage_count` sobe na APROVAÇÃO, não no rascunho.** Regenerar três vezes não
pode inflar o contador e envenenar o critério de rotação.

**`art_job_reference` é a fonte única da ordem.** A ordem das linhas é a ordem
das `InlineDataPart` no worker E a ordem enumerada no bloco técnico. Não há mais
duas listas espelhadas que podem divergir.

**Logo por composite.** Com `logo_mode = 'composite'` (padrão) a logo não é
referência: o `sharp` sobrepõe depois da geração e o system prompt manda o
modelo deixar o canto superior esquerdo calmo. Determinístico e sempre nítido.
Com `logo_mode = 'reference'` ela entra na posição 0.

---

## Variáveis de ambiente

| Variável | Descrição |
|---|---|
| `ANTHROPIC_API_KEY` | Obrigatória — direção de arte e anotação de referências |
| `ART_DIRECTOR_MODEL` | Modelo da direção de arte (default: `claude-sonnet-4-5-20250929`) |
| `ANTHROPIC_MODEL` | Modelo das tarefas de descrição (default: Haiku) |
| `GEMINI_API_KEY` | Obrigatória — geração de imagem |
| `IMAGE_MODEL` | Default: `gemini-3-pro-image` |

---

## Loop de aprendizado (não implementado nesta fase)

O schema já guarda os três sinais: o `steer` do operador (em `direction.steer`),
o diff `prompt_draft` × `prompt_edited`, e a aprovação da arte. A destilação
desses sinais em `client_creative_profile.direction_notes` — que já é lido e
injetado no prompt por `prepare.ts` — é o próximo passo.

Sem ele, a camada entrega prompts melhores mas o ajuste manual continua sendo
trabalho do operador, só que em outro lugar. A métrica que diz se está
funcionando: **taxa de aprovação sem edição** (`prompt_edited IS NULL`) por
semana. Se essa curva não subir em 4 a 6 semanas, o problema é o system prompt
ou o acervo — não o volume.
