import { z } from "zod";

export type AgentRunStatus =
  | "queued"
  | "generating"
  | "awaiting_approval"
  | "approved"
  | "rejected"
  | "failed";

export type AgentRunMode = "ai" | "manual";

/** carousel: cards em imagem · single: arte única · tweet: carrossel "print de tweet". */
export type AgentFormat = "carousel" | "single" | "tweet";
export const AGENT_FORMATS: AgentFormat[] = ["carousel", "single", "tweet"];

export type TweetTheme = "light" | "dark";
export type AgentRunOptions = { theme?: TweetTheme };

/** Plano do carrossel: o que vai escrito em cada card e como ele deve parecer. */
export const agentPlanSchema = z.object({
  title: z.string().describe("Nome curto do carrossel (para a lista de aprovação)."),
  styleGuide: z
    .string()
    .describe(
      "Guia visual ÚNICO do carrossel, valendo para todos os cards: fundo, paleta (hex do perfil), tipografia descrita, hierarquia, alinhamento, elementos gráficos que se repetem, estilo de foto/ilustração."
    ),
  cards: z
    .array(
      z.object({
        texts: z
          .array(z.string())
          .describe("Textos que aparecem no card, na ordem de leitura (título primeiro). Português do Brasil."),
        cta: z
          .string()
          .nullable()
          .describe("Texto do botão de CTA. Só no último card, quando fizer sentido; senão null."),
        visual: z
          .string()
          .describe("O que este card mostra além dos textos: composição, imagem/ilustração, destaque."),
      })
    )
    .describe("Cards na ordem do carrossel. O primeiro é a capa."),
  caption: z.string().describe("Legenda do post, sem hashtags. Português do Brasil."),
  hashtags: z.array(z.string()).describe("De 5 a 15 hashtags relevantes, sem o #."),
});

export type AgentPlan = z.infer<typeof agentPlanSchema>;

export type AgentCardStatus = "pending" | "generating" | "ready" | "failed";

export type AgentCard = {
  index: number;
  status: AgentCardStatus;
  url: string | null;
  path: string | null;
  prompt: string | null;
  attempts: number;
  /** Revisão automática do texto do card (modelo de visão). */
  qa: { ok: boolean; issues: string[] } | null;
  error: string | null;
  /** Instrução extra pedida na aprovação ("refazer com..."). */
  instruction?: string | null;
};

export type AgentRun = {
  id: string;
  profile_id: string | null;
  client_id: string | null;
  profile_name: string;
  ig_user_id: string;
  ig_username: string | null;
  mode: AgentRunMode;
  format: AgentFormat;
  options: AgentRunOptions;
  input: string;
  card_count: number | null;
  scheduled_at: string | null;
  status: AgentRunStatus;
  plan: AgentPlan | null;
  cards: AgentCard[];
  caption: string;
  error: string | null;
  feedback: string | null;
  instagram_post_id: string | null;
  generation_id: string | null;
  generation_started_at: string | null;
  external_ref: string | null;
  callback_url: string | null;
  decided_by: string | null;
  decided_at: string | null;
  created_at: string;
  updated_at: string;
};

/** Formato do feed: 4:5, que é o máximo de altura que o Instagram aceita. */
export const AGENT_CARD_WIDTH = 1080;
export const AGENT_CARD_HEIGHT = 1350;
export const AGENT_MIN_CARDS = 2;
export const AGENT_MAX_CARDS = 10;
