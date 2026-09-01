import {
  ArrowRight,
  ChevronRight,
  MoveRight,
  ShoppingCart,
  ShoppingBag,
  Sparkles,
  Heart,
  Star,
  Play,
  Download,
  Send,
  ExternalLink,
  Bell,
  Zap,
  Flame,
  ThumbsUp,
  MessageCircle,
  AtSign,
  type LucideIcon,
} from "lucide-react";

export type CtaIconDef = { id: string; label: string; Icon: LucideIcon };

export const CTA_ICONS: CtaIconDef[] = [
  { id: "ArrowRight", label: "Seta", Icon: ArrowRight },
  { id: "ChevronRight", label: "Chevron", Icon: ChevronRight },
  { id: "MoveRight", label: "Seta longa", Icon: MoveRight },
  { id: "ShoppingCart", label: "Carrinho", Icon: ShoppingCart },
  { id: "ShoppingBag", label: "Sacola", Icon: ShoppingBag },
  { id: "Sparkles", label: "Brilho", Icon: Sparkles },
  { id: "Heart", label: "Coração", Icon: Heart },
  { id: "Star", label: "Estrela", Icon: Star },
  { id: "Play", label: "Play", Icon: Play },
  { id: "Download", label: "Download", Icon: Download },
  { id: "Send", label: "Enviar", Icon: Send },
  { id: "ExternalLink", label: "Link", Icon: ExternalLink },
  { id: "Bell", label: "Sino", Icon: Bell },
  { id: "Zap", label: "Raio", Icon: Zap },
  { id: "Flame", label: "Fogo", Icon: Flame },
  { id: "ThumbsUp", label: "Curtir", Icon: ThumbsUp },
  { id: "MessageCircle", label: "Balão", Icon: MessageCircle },
  { id: "AtSign", label: "Arroba", Icon: AtSign },
];

const ICON_MAP = new Map(CTA_ICONS.map((i) => [i.id, i.Icon]));

export function getCtaIcon(id?: string | null): LucideIcon | null {
  if (!id) return null;
  return ICON_MAP.get(id) ?? null;
}
