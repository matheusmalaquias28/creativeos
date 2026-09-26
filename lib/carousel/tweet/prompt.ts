import type Anthropic from "@anthropic-ai/sdk";

export type TweetContentMode = "ai" | "manual";

export type TweetSpec = {
  titulo: string;
  cards: { texto: string }[];
};

export const BUILD_TWEET_TOOL: Anthropic.Messages.Tool = {
  name: "build_tweet_carousel",
  description: "Entrega o carrossel estilo tweet, já dividido em cards.",
  input_schema: {
    type: "object",
    properties: {
      titulo: {
        type: "string",
        description: "Nome curto (até 6 palavras) para identificar o carrossel na lista.",
      },
      cards: {
        type: "array",
        minItems: 1,
        maxItems: 15,
        items: {
          type: "object",
          properties: {
            texto: {
              type: "string",
              description:
                "Texto do card. Use \\n\\n para separar parágrafos e **trecho** para negrito.",
            },
          },
          required: ["texto"],
        },
      },
    },
    required: ["titulo", "cards"],
  },
};

const COMMON_RULES = `Regras de formato (valem para todos os cards):
- Cada card é um "tweet" que vira uma imagem 4:5. Ideal de 120 a 320 caracteres por card; nunca passe de 420.
- Separe ideias em parágrafos curtos com \\n\\n (uma linha em branco entre eles).
- Use **negrito** com parcimônia, só para a frase que precisa saltar aos olhos (no máximo 1 trecho por card).
- Sem hashtags, sem emojis em excesso, sem numeração do tipo "1/7".
- Nunca use travessão (— ou –); use vírgula ou ponto.
- Português do Brasil.`;

export function buildTweetSystemPrompt(opts: {
  mode: TweetContentMode;
  profileName: string;
  handle: string;
  cardCount?: number;
}): string {
  const author = `${opts.profileName} (${opts.handle})`;

  if (opts.mode === "manual") {
    return `Você organiza conteúdo já escrito em um carrossel de Instagram no estilo "print de tweet", publicado por ${author}.

Sua tarefa é SOMENTE dividir o texto do usuário em cards. Preserve as palavras do autor: não reescreva, não resuma, não invente frases nem acrescente conclusões. Pode apenas corrigir erros óbvios de digitação e ajustar pontuação/quebras de parágrafo para a leitura fluir.
Quebre nos pontos naturais da narrativa, mantendo cada card com uma ideia completa. Se o texto já vier separado em blocos/cards pelo usuário, respeite essa divisão.

${COMMON_RULES}

Ao final chame a ferramenta build_tweet_carousel.`;
  }

  const count = opts.cardCount
    ? `Gere exatamente ${opts.cardCount} cards.`
    : "Escolha entre 5 e 8 cards, o que a ideia pedir.";

  return `Você é um copywriter de conteúdo viral para Instagram. Escreva um carrossel no estilo "print de tweet", na voz de ${author}, em primeira pessoa, tom de conversa direta com quem lê.

Estrutura:
- Card 1: gancho forte que prende (uma afirmação, frase de impacto ou contradição), seguido de uma frase que promete o que vem.
- Cards do meio: desenvolva com uma história, exemplo concreto ou cenário do dia a dia, uma ideia por card, cada card puxando o próximo.
- Último card: fechamento com a lição principal e um convite leve à ação (salvar, comentar, seguir).
${count}

${COMMON_RULES}

Ao final chame a ferramenta build_tweet_carousel.`;
}
