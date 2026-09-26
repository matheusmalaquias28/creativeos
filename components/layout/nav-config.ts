import {
  ClipboardList,
  CreditCard,
  Globe,
  Images,
  LayoutDashboard,
  Layers,
  ShieldCheck,
  Users,
  Wand2,
  type LucideIcon,
} from "lucide-react";
import type { Tone } from "@/lib/design/tokens";
import { canAccessPath, type AppRole } from "@/lib/auth/permissions";

export type NavChild = { href: string; label: string };

export type NavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
  /** Tom usado no command menu e nos cabeçalhos de página. */
  tone: Tone;
  /** Texto extra para a busca do command menu. */
  keywords?: string;
  children?: NavChild[];
};

export type NavSection = {
  id: string;
  label: string;
  items: NavItem[];
};

/**
 * Fonte única da navegação — sidebar, menu mobile e command menu (⌘K) leem
 * daqui. Para adicionar uma área nova, basta incluir o item na seção certa.
 */
export const NAV_SECTIONS: NavSection[] = [
  {
    id: "overview",
    label: "Visão geral",
    items: [
      {
        href: "/dashboard",
        label: "Dashboard",
        icon: LayoutDashboard,
        tone: "violet",
        keywords: "inicio home resumo métricas",
      },
    ],
  },
  {
    id: "operation",
    label: "Operação",
    items: [
      {
        href: "/demands",
        label: "Demandas",
        icon: ClipboardList,
        tone: "cyan",
        keywords: "kanban briefing fila artes",
      },
      {
        href: "/web-demands",
        label: "Demandas Web",
        icon: Globe,
        tone: "blue",
        keywords: "site landing page",
      },
      {
        href: "/clients",
        label: "Clientes",
        icon: Users,
        tone: "orange",
        keywords: "marcas brand dna onboarding",
      },
      {
        href: "/assinaturas",
        label: "Assinaturas",
        icon: CreditCard,
        tone: "green",
        keywords: "hubla pagamentos planos",
      },
    ],
  },
  {
    id: "studio",
    label: "Estúdio",
    items: [
      {
        href: "/gerador",
        label: "Gerador",
        icon: Wand2,
        tone: "pink",
        keywords: "gerar imagem ia arte",
      },
      {
        href: "/carousel",
        label: "Carrosséis",
        icon: Layers,
        tone: "lime",
        keywords: "carrossel instagram slides",
        children: [
          { href: "/carousel", label: "Todos os carrosséis" },
          { href: "/carousel/perfis", label: "Perfis" },
        ],
      },
      {
        href: "/galeria",
        label: "Galeria",
        icon: Images,
        tone: "amber",
        keywords: "artes imagens aprovadas",
      },
    ],
  },
  {
    id: "admin",
    label: "Administração",
    items: [
      {
        href: "/usuarios",
        label: "Usuários",
        icon: ShieldCheck,
        tone: "violet",
        keywords: "acessos permissões roles perfis senha equipe",
      },
    ],
  },
];

/** Navegação visível para a role (itens, sub-itens e seções vazias somem). */
export function navSectionsFor(role: AppRole): NavSection[] {
  return NAV_SECTIONS.map((section) => ({
    ...section,
    items: section.items
      .filter((item) => canAccessPath(role, item.href))
      .map((item) => ({
        ...item,
        children: item.children?.filter((child) => canAccessPath(role, child.href)),
      })),
  })).filter((section) => section.items.length > 0);
}

export const NAV_ITEMS: NavItem[] = NAV_SECTIONS.flatMap((s) => s.items);

export function isNavItemActive(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function isNavChildActive(pathname: string, href: string) {
  if (href === "/carousel") {
    return (
      pathname === "/carousel" ||
      (pathname.startsWith("/carousel/") && !pathname.startsWith("/carousel/perfis"))
    );
  }
  return isNavItemActive(pathname, href);
}

/** Item de navegação dono da rota atual (para cabeçalhos/breadcrumbs). */
export function findNavItem(pathname: string): NavItem | undefined {
  return NAV_ITEMS.find((item) => isNavItemActive(pathname, item.href));
}
