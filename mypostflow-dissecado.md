# MyPostFlow — Dissecção Completa do Sistema de Gerador de Carrosséis

> Análise feita via inspeção do editor em `mypostflow.com/gerador`.  
> Objetivo: replicar a arquitetura e funcionalidades em um projeto próprio.

---

## 1. Stack Técnico

| Camada | Tecnologia |
|---|---|
| Framework | Next.js **App Router** (Next.js 13+) |
| Deploy | **Vercel** (parâmetro `dpl=` nos scripts, CDN automático) |
| Bundler | **Turbopack** (chunks `/_next/static/chunks/turbopack-*`) |
| Error Monitoring | **Sentry** (global `__SENTRY__`) |
| Analytics | **PostHog** (`__PosthogExtensions__`) + analytics próprio (`__mpfAnalyticsLoaded`) |
| Renderização slides | **HTML + CSS puro** (zero `<canvas>` em idle) |
| Export de imagem | **Client-side** — provavelmente `html-to-image` ou `modern-screenshot` carregado como chunk lazy |
| Persistência | Autosave via `Ctrl+S` / botão "Salvar" — dados salvos no servidor |

---

## 2. Formatos Suportados

| Formato | Dimensão | Proporção |
|---|---|---|
| Carrossel | 1080 × 1350 px | 4:5 |
| Quadrado | 1080 × 1080 px | 1:1 |
| Stories | 1080 × 1920 px | 9:16 |

- **Máximo de 20 slides** por carrossel.
- O editor renderiza os slides em escala reduzida (~562 × 702 px) e exporta na resolução real (1080 px).

---

## 3. Endpoints de API

Todos os recursos de IA passam por **um único endpoint**.

| Endpoint | Método | Função |
|---|---|---|
| `/api/generate` | POST | Toda geração de IA (slides, legenda, refinar, imagens) |
| `/api/notifications/unread-count` | GET | Badge de notificações no header |
| `/ingest/i/v0/e` | POST | Telemetria de eventos (PostHog-style) |
| `/ingest/s` | POST | Telemetria de sessão |

### Payload esperado de `/api/generate`

O tipo de operação é diferenciado pelo campo no payload (não há endpoints separados). Estrutura provável:

```json
{
  "type": "carousel" | "caption" | "refine" | "improve" | "image",
  "prompt": "string com o tema ou instrução",
  "currentContent": {
    "slides": [
      { "titulo": "...", "subtitulo": "..." }
    ]
  },
  "slideCount": 5,
  "generateImages": false
}
```

### Resposta de `/api/generate` (carrossel)

```json
{
  "slides": [
    { "titulo": "TÍTULO DO SLIDE", "subtitulo": "Subtítulo ou frase de apoio" }
  ]
}
```

### Resposta de `/api/generate` (legenda)

```json
{
  "caption": "Texto completo da legenda com emojis e hashtags"
}
```

---

## 4. Sistema de Créditos

- Exibido no header: "115 Créditos"
- **Consumido a cada chamada** a `/api/generate`
- Operações que debitam créditos:
  - Gerar N slides a partir de prompt
  - Gerar imagem de fundo com IA
  - Refinar um slide
  - Melhorar conteúdo atual
  - Gerar legenda + hashtags
- Operações gratuitas: edição manual, troca de estilo, tipografia, export

---

## 5. Arquitetura do Editor (Sidebar Completo)

O painel lateral é dividido em duas áreas:

```
┌─────────────────────────────┐
│  [GLOBAL DO POST]           │
│  Estilo do Post             │
│  Templates de Estilo        │
│  Gerar com IA               │
│  Identidade Visual          │
├─────────────────────────────┤
│  [CONTEÚDO — SLIDE NN]      │  ← muda ao navegar entre slides
│  Imagem de Fundo            │
│  Sombra / Overlay           │
│  Fundo do Slide             │
│  Grade de Imagens           │
│  Texto & IA                 │
│  Layout do Texto            │
│  Tipografia                 │
│  Destaques & Formatação     │
│  Badge de Perfil            │
│  Logo da Marca              │
├─────────────────────────────┤
│  [ESTILO GLOBAL]            │
│  Cantos                     │
│  Botões / CTAs              │
└─────────────────────────────┘
```

---

## 6. Detalhamento de Cada Seção

### 6.1 Estilo do Post

4 layouts base que definem a estrutura visual geral do carrossel:

| Layout | Descrição |
|---|---|
| **Minimal** | Minimalista, foco no texto |
| **Profile** | Perfil com foto de destaque |
| **Creators** | Estilo creator/influenciador |
| **TechViral** | Estilo tech/viral agressivo |

Mudar o layout altera a estrutura dos componentes (posição do badge, rodapé, etc.), não apenas o visual.

---

### 6.2 Templates de Estilo

Sistema de **preset saving**:
- Salvar o estilo visual atual com um nome personalizado
- Reutilizar em novos carrosséis
- Campo: `Nome do template` → botão salvar
- Lista de templates salvos abaixo

---

### 6.3 Gerar com IA

Dois modos de operação:

#### Modo 1 — Geração do zero
```
[textarea]  → Descreva o tema...
              Ex: "Como vender mais no Instagram sem aparecer"

[slider]    → Quantidade de slides (ex: 5)

[toggle]    → Gerar imagens com IA (para cada slide)

[botão]     → Gerar 5 slides
              ↓ chama POST /api/generate com type: "carousel"
```

#### Modo 2 — Melhoria do conteúdo atual
```
[textarea]  → Descreva o que quer ajustar...
              Ex: "Deixe os títulos mais diretos e impactantes"

[botão]     → Melhorar Conteúdo com IA
              ↓ chama POST /api/generate com type: "improve"
                e passa os slides atuais como contexto
```

---

### 6.4 Identidade Visual

#### Aba Manual
- **3 cores editáveis**: Fundo, Título, Subtítulo
- Input hex com color picker
- Preview ao vivo (card com "Título de exemplo" + subtítulo)
- Botão **"Aplicar em todos os slides"** — aplica as 3 cores a todo o carrossel de uma vez

#### Aba Via Imagem
- Upload de logo/banner/foto da marca (até 20 MB)
- Extração automática das cores dominantes
- Preenche automaticamente as 3 cores da identidade

#### Brand Kit
- Sistema de salvamento de identidade visual da marca
- Configurado em `Configurações → Marca`
- Pode salvar o carrossel atual como Brand Kit
- Carregado automaticamente em novos carrosséis

---

### 6.5 Imagem de Fundo

Controles por slide:

| Controle | Detalhes |
|---|---|
| Upload | PNG/JPG até 25 MB |
| Colar Imagem | Cola da área de transferência |
| Gerar com IA | `POST /api/generate` com type: "image" |
| Posição X | Slider 0–100 (deslocamento horizontal) |
| Posição Y | Slider 0–100 (deslocamento vertical) |
| Zoom % | Slider — padrão 175% |

---

### 6.6 Sombra / Overlay

20+ estilos de overlay sobre a imagem de fundo:

```
Nenhum
Gradiente        Grad. forte
Vinheta          Vin. forte
Escuro           Escuro forte
Base             Base forte (padrão)    Base intensa
Topo             Topo forte             Topo intenso
Moldura          Mold. forte
Esquerda         Direita
Diag. inf.esq    Diag. inf.dir
Diag. sup.esq    Diag. sup.dir
```

- **Opacidade**: slider 0–100 (padrão: 90)

---

### 6.7 Fundo do Slide

| Controle | Detalhes |
|---|---|
| Cor hex | Input direto (ex: `#0a0a0a`) |
| Paleta de tons | 8 variações: Escuro+ → Escuro médio → Escuro suave → Semi-escuro → Semi-claro → Claro suave → Claro médio → Claro+ |
| Embaralhar | Gera cores aleatórias diferentes para cada slide |
| Padrão | Sobreposição sobre cor de fundo: **Nenhum \| Grade \| Bolinhas \| Linhas Horizontais \| Linhas Diagonais \| Xadrez Diagonal** |

---

### 6.8 Grade de Imagens

- Toggle simples: **Mostrar grade**
- Exibe uma grade de alinhamento sobre o slide durante a edição

---

### 6.9 Texto & IA

Edição de conteúdo por slide + refinamento com IA:

```
TÍTULO
  [textarea]  → Texto atual do título
  Tamanho:    slider px (padrão: 96px)

SUBTÍTULO
  [textarea]  → Texto atual do subtítulo
  Tamanho:    slider px (padrão: 32px)

REFINAR SLIDE COM IA
  [textarea]  → Ex: "deixe mais agressivo", "encurte o subtítulo",
                    "adicione dado estatístico"
  [botão]     → Refinar este slide
                ↓ chama POST /api/generate com type: "refine"
                  passando título/subtítulo atuais + instrução
```

---

### 6.10 Layout do Texto

#### Posição (grid 3×3)
```
[ Sup. Esq ]  [ Sup. Cen ]  [ Sup. Dir ]
[ Meio Esq ]  [   Meio   ]  [ Meio Dir ]
[ Inf. Esq ]  [ Inf. Cen ]  [ Inf. Dir ]  ← padrão selecionado
```

| Controle | Detalhes |
|---|---|
| Glass ao redor do conteúdo | Toggle — aplica efeito glassmorphism no bloco de texto |
| Margens Horizontais | Espaço entre texto e laterais do slide (px) |
| Margens Verticais | Espaço entre texto e topo/base do slide (px) |

---

### 6.11 Tipografia

#### Geral
- **Escala Global %**: zoom proporcional no bloco inteiro (sem alterar quebras de linha)
- **Espaçamento entre linhas**: slider (padrão: 21)

#### Por elemento (Título / Subtítulo)

**Fontes disponíveis (13):**

| Família | Estilo |
|---|---|
| Inter | Sans-serif moderna |
| Space Grotesk | Geométrica |
| Syne | Display |
| Outfit | Clean |
| DM Sans | Sans humanista |
| Raleway | Elegante |
| Bebas Neue | Display condensada all-caps |
| Playfair Display | Serif editorial |
| Cormorant | Serif elegante |
| Montserrat | Geométrica clássica |
| Plus Jakarta Sans | Moderna |
| Manrope | Geométrica leve |
| Urbanist | Minimalista |

**Peso (font-weight):**
`100 | 200 | 300 | 400 | 500 | 600 | 700 | 800`

**Cor:**
- Auto (herda tema do slide)
- Paleta de 8 cores predefinidas
- Input hex manual

**Espaçamento entre letras (letter-spacing):**
- 0 = padrão; positivos = espaçam; negativos = comprimem

---

### 6.12 Destaques & Formatação

Sistema de **formatação por palavra** dentro do título e subtítulo:

#### Etapa 1 — Destacar palavras (cor de destaque)
- Título e subtítulo são parseados em tokens (palavras individuais)
- Clicar em uma palavra a marca com a cor de destaque
- **Paleta de destaque**: amarelo, vermelho, azul, verde, laranja, roxo, rosa, ciano + hex

#### Etapa 2 — Formatação Rica
- As palavras aparecem como botões clicáveis (estilo do texto atual)
- Selecionar uma palavra → aplicar formatação:
  - **B** — Bold
  - *I* — Italic
  - __U__ — Underline
  - ~~S~~ — Strikethrough

> Isso é renderizado inline via `<span>` com estilos específicos por palavra.

---

### 6.13 Badge de Perfil

Overlay com foto + @ do criador, exibido sobre o slide:

| Controle | Detalhes |
|---|---|
| Foto | Upload PNG/JPG (até 25 MB) ou colar |
| @ do perfil | Texto livre (ex: `@seuperfil`) |
| Cor do texto | Auto ou manual |
| Estilo | **Glass \| Sólido \| Minimal \| Cor única \| Degradê** |
| Opacidade do fundo | Slider 0–100 (padrão: 100) |
| Arredondamento | Slider (border-radius) |
| Tamanho global | Aplica a todos os slides |
| Tamanho individual | Por slide específico |
| Visibilidade | Checkbox por slide + botão "Todos" |

> Badge é um componente **global** (foto/@ configurados uma vez) mas com visibilidade e tamanho **por slide**.

---

### 6.14 Logo da Marca

- Upload de PNG (transparência preservada)
- Posicionado **livremente** sobre o slide (drag & drop provavelmente)
- **Arquivo global** — um logo para todo o carrossel
- **Visibilidade por slide** — checkbox + botão "Todos"

---

### 6.15 Cantos (Estilo Global)

4 textos posicionados nos cantos do slide:

```
┌─ @seuusuario ────────────── Categoria ─┐
│                                         │
│              [slide content]            │
│                                         │
└─ Prospecção ─────────────── Arrasta ───┘
```

| Controle | Detalhes |
|---|---|
| Toggle por canto | Ativar/desativar cada um dos 4 textos individualmente |
| Exibir cantos | Toggle global on/off |
| Indicadores de quantidade | Mostra "Slide X de Y" automaticamente |
| Tamanho da fonte | Slider |
| Distância das bordas | Margem interna dos cantos |
| Opacidade | Slider 0–100 (padrão: 60) |
| Estilo | **Nenhum \| Glass \| Sólido \| Minimalista \| Cor única \| Degradê** |

#### Ícone no canto inferior direito

8 opções:
```
—  □  ›  ♥  ↗  ✉  ⚙  ✕
```

---

### 6.16 Botões / CTAs (Estilo Global)

| Controle | Detalhes |
|---|---|
| Mostrar botões | Toggle principal |
| Botão 1 | Texto livre (ex: "Abrir meu painel") |
| Segundo botão | Toggle — ativa Botão 2 |
| Botão 2 | Texto livre (ex: "Como funciona") |
| Estilo | **Sólido \| Contorno \| Glass \| Degradê** |
| Cor do botão | Paleta + hex |

Os botões aparecem sobrepostos no slide, abaixo do subtítulo.

---

## 7. Barra Superior (Header)

```
[MyPostFlow Studio]
  ← Voltar para Dashboard

[Carrossel ▾]  [↩] [↪]  [‹] [Slide 1 de 1] [›]  [+] [🗑]
                                           [Baixar Slide 1] [Salvar] [✨ Gerar Legenda] [115 Créditos] [☀] [🔔] [👤]
```

| Controle | Atalho | Função |
|---|---|---|
| Dropdown formato | — | Carrossel / Quadrado / Stories |
| Desfazer | Ctrl+Z | Undo |
| Refazer | Ctrl+Y | Redo |
| ‹ › | — | Navegar entre slides |
| + | — | Novo slide (máx 20) |
| 🗑 | — | Remover slide atual |
| Baixar Slide N | — | Export client-side PNG |
| Salvar | Ctrl+S | Persiste no servidor |
| Gerar Legenda | — | `POST /api/generate` → modal legenda + hashtags |
| Créditos | — | Saldo de créditos |

---

## 8. Fluxos de IA — Detalhamento

### 8.1 Gerar Carrossel do Zero

```
1. Usuário escreve tema no campo "Gerar com IA"
2. Define quantidade de slides (slider)
3. Opcionalmente ativa "Gerar imagens com IA"
4. Clica "Gerar N slides"
   ↓
5. POST /api/generate
   { type: "carousel", prompt, slideCount, generateImages }
   ↓
6. Resposta: array de { titulo, subtitulo, imagemUrl? }
   ↓
7. Editor cria N slides, preenche títulos/subtítulos
8. Se generateImages: cada slide recebe imagem de fundo gerada
9. Créditos debitados
```

### 8.2 Refinar um Slide

```
1. Usuário está no slide X
2. Abre "Texto & IA" → "Refinar Slide com IA"
3. Digita instrução: "torne mais direto e com dado estatístico"
4. Clica "Refinar este slide"
   ↓
5. POST /api/generate
   { type: "refine", slideIndex, titulo, subtitulo, instruction }
   ↓
6. Resposta: { titulo, subtitulo } novos
   ↓
7. Slide X atualizado no editor
8. 1 crédito debitado
```

### 8.3 Melhorar Conteúdo Global

```
1. Usuário digita em "Gerar com IA" → campo de melhoria
2. Ex: "Deixe os títulos mais impactantes e use linguagem descontraída"
3. Clica "Melhorar Conteúdo com IA"
   ↓
4. POST /api/generate
   { type: "improve", slides: [...todos os slides atuais...], instruction }
   ↓
5. Resposta: slides[] reescritos
   ↓
6. Todos os slides têm títulos/subtítulos atualizados
7. Créditos proporcionais ao número de slides
```

### 8.4 Gerar Imagem de Fundo

```
1. Usuário está em "Imagem de Fundo"
2. Clica "Gerar Imagem com IA"
   ↓
3. POST /api/generate
   { type: "image", prompt?, slideContext: { titulo, subtitulo } }
   ↓
4. Resposta: { imageUrl } (provavelmente URL temporária ou base64)
   ↓
5. Imagem aplicada como background do slide
6. Créditos debitados
```

### 8.5 Gerar Legenda + Hashtags

```
1. Usuário clica "Gerar Legenda" no header
   ↓
2. POST /api/generate
   { type: "caption", slides: [...todos os slides atuais...] }
   ↓
3. Resposta: { caption: "texto completo com emojis e hashtags" }
   ↓
4. Modal exibe legenda gerada
5. Opções: Copiar | Regerar com IA
6. 1 crédito debitado
```

---

## 9. Fluxo de Export (Client-Side)

```
Usuário clica "Baixar Slide N"
      ↓
Nenhuma chamada de API feita
      ↓
Biblioteca client-side (html-to-image / modern-screenshot)
captura o elemento DOM do slide
      ↓
Escala: 562px (editor) → 1080px (export)
Aplica devicePixelRatio ou scale manual
      ↓
Converte DOM → Canvas → PNG Blob
      ↓
URL.createObjectURL(blob)
      ↓
<a download="slide-N.png"> criado e clicado programaticamente
      ↓
Arquivo PNG baixado no browser do usuário
```

> **Para implementar:** use `html-to-image` ou `modern-screenshot`:
> ```ts
> import { toPng } from 'html-to-image'
> 
> const dataUrl = await toPng(slideRef.current, {
>   width: 1080,
>   height: 1350,
>   pixelRatio: 1080 / slideRef.current.offsetWidth
> })
> 
> const link = document.createElement('a')
> link.download = 'slide-1.png'
> link.href = dataUrl
> link.click()
> ```

---

## 10. Estrutura de Estado (Estado por Slide)

Com base nos controles do editor, cada slide tem o seguinte estado:

```ts
interface Slide {
  id: string

  // Conteúdo
  titulo: string
  subtitulo: string
  tamanhoTitulo: number      // px, padrão 96
  tamanhoSubtitulo: number   // px, padrão 32

  // Fundo
  corFundo: string           // hex, ex: "#0a0a0a"
  padraoFundo: 'none' | 'grid' | 'dots' | 'lines-h' | 'lines-d' | 'chess'
  imagemFundo?: string       // URL ou base64
  imagemPosX: number         // 0-100, padrão 50
  imagemPosY: number         // 0-100, padrão 50
  imagemZoom: number         // %, padrão 175

  // Overlay
  overlayEstilo: OverlayStyle // 'none' | 'gradient' | 'bottom-strong' | ...
  overlayOpacidade: number    // 0-100, padrão 90

  // Layout
  posicaoTexto: TextPosition  // 'bottom-left' | 'center' | ... (9 opções)
  glass: boolean
  margemHorizontal: number
  margemVertical: number

  // Destaques
  palavrasDestacadas: string[]
  corDestaque: string         // hex
  formatacaoRica: Record<string, WordFormat>  // por palavra

  // Visibilidade de elementos globais neste slide
  exibirBadge: boolean
  exibirLogo: boolean
  exibirCantos: boolean
  tamanhoIndividualBadge: number
}

interface WordFormat {
  bold?: boolean
  italic?: boolean
  underline?: boolean
  strikethrough?: boolean
}
```

---

## 11. Estado Global do Carrossel

```ts
interface Carousel {
  id: string
  nome: string
  formato: 'carousel' | 'square' | 'stories'  // 4:5 | 1:1 | 9:16
  slides: Slide[]

  // Estilo do post
  estiloPost: 'minimal' | 'profile' | 'creators' | 'techviral'

  // Identidade visual
  corFundo: string
  corTitulo: string
  corSubtitulo: string

  // Tipografia
  escalaGlobal: number        // %, padrão 100
  espacamentoLinhas: number   // padrão 21
  fonteTitulo: FontFamily
  fonteTituloWeight: number
  fonteTituloCor: string      // 'auto' ou hex
  fonteTituloLetterSpacing: number
  fonteSubtitulo: FontFamily
  // ...idem subtítulo

  // Badge de perfil (global)
  badgeFoto?: string
  badgeArroba: string
  badgeEstilo: BadgeStyle
  badgeOpacidade: number
  badgeArredondamento: number
  badgeTamanhoGlobal: number
  badgeCorTexto: string

  // Logo da marca (global)
  logoUrl?: string

  // Cantos (global)
  cantosTextos: {
    supEsq: string; supDir: string
    infEsq: string; infDir: string
  }
  cantosVisiveis: boolean
  cantosEstilo: CornerStyle
  cantosIndicadores: boolean
  cantosTamanhoFonte: number
  cantosDistancia: number
  cantosOpacidade: number
  cantosIcone: CornerIcon

  // CTAs (global)
  mostrarBotoes: boolean
  botao1: string
  botao2?: string
  botoesEstilo: ButtonStyle
  botoesCor: string
}
```

---

## 12. Componentes Visuais do Slide

Hierarquia de camadas (z-index, de baixo para cima):

```
┌─────────────────────────────────────┐
│ 1. Cor de fundo (background-color)  │  ← camada base
│ 2. Padrão sobre o fundo (SVG/CSS)   │
│ 3. Imagem de fundo (object-fit)     │
│ 4. Overlay / Sombra (gradient CSS)  │
│ 5. Grade de alinhamento (opcional)  │
│ 6. Bloco de texto (título/subtítulo)│  ← posicionado pelos 9 pontos
│    └── Glass effect (opcional)      │
│ 7. Botões / CTAs                    │
│ 8. Badge de perfil                  │  ← abs. posicionado
│ 9. Logo da marca                    │  ← abs. posicionado
│ 10. Textos dos cantos               │  ← 4 cantos
│ 11. Ícone do canto inferior direito │
└─────────────────────────────────────┘
```

---

## 13. Recomendações para Implementação

### Para o editor
- **Gerenciamento de estado**: Zustand ou Jotai (state granular por slide)
- **Undo/Redo**: `use-undoable` ou implementar manualmente com histórico de snapshots
- **Renderização do slide**: componente React puro com CSS absolute positioning
- **Preview escalado**: `transform: scale(0.52)` no container do editor

### Para o export
```bash
npm install html-to-image
# ou
npm install modern-screenshot
```

### Para a IA
- Um único `POST /api/generate` com `type` no body
- Em Next.js App Router: `app/api/generate/route.ts`
- Usar streaming response para geração longa (múltiplos slides)

### Para as fontes do Google Fonts
```ts
// next.config.ts ou layout.tsx
import { Inter, Space_Grotesk, Syne, Outfit, DM_Sans, Raleway, 
         Bebas_Neue, Playfair_Display, Cormorant, Montserrat, 
         Plus_Jakarta_Sans, Manrope, Urbanist } from 'next/font/google'
```

### Modelo de créditos
- Créditos como coluna no banco do usuário
- Middleware que verifica e debita antes de chamar IA
- Diferentes custos por operação:
  - Gerar carrossel (N slides): N créditos
  - Gerar imagem: 2-3 créditos
  - Refinar slide: 1 crédito
  - Melhorar global: N créditos
  - Legenda: 1 crédito

---

## 14. Diagrama de Fluxo Geral

```
Usuario
  │
  ├─► Dashboard → cria novo carrossel → /gerador?id=xxx
  │
  └─► Editor
        │
        ├─► Sidebar (controles)
        │     ├─► Atualiza estado local (Zustand/useState)
        │     ├─► Preview re-renderiza em tempo real
        │     └─► [IA] → POST /api/generate → atualiza estado
        │
        ├─► Header
        │     ├─► Salvar → POST /api/carroseis/:id (autosave)
        │     ├─► Gerar Legenda → POST /api/generate → modal
        │     └─► Baixar → client-side PNG export
        │
        └─► Canvas
              ├─► Slide ativo (editável)
              └─► + Novo Slide (até 20)
```

---

*Documento gerado por análise de inspeção do editor mypostflow.com/gerador — Agosto 2025.*
