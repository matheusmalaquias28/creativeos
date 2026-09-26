import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { stripUnsafeHtml } from "@/lib/carousel/sanitize-html";
import type { TweetCard, TweetProfileSnapshot } from "@/types/tweet-carousel";

type SaveBody = {
  name?: string;
  theme?: "light" | "dark";
  cards?: TweetCard[];
  profileId?: string | null;
  profile?: TweetProfileSnapshot;
};

function cleanCard(raw: unknown): TweetCard | null {
  if (!raw || typeof raw !== "object") return null;
  const c = raw as Record<string, unknown>;
  if (typeof c.id !== "string") return null;
  const size = typeof c.fontSize === "number" ? Math.round(c.fontSize) : null;
  return {
    id: c.id.slice(0, 64),
    html: stripUnsafeHtml(typeof c.html === "string" ? c.html : "").slice(0, 20_000),
    imageUrl:
      typeof c.imageUrl === "string" && /^https?:\/\//.test(c.imageUrl) ? c.imageUrl : null,
    fontSize: size && size >= 16 && size <= 96 ? size : null,
  };
}

/**
 * Autosave do editor. Rota (e não server action) para aceitar `fetch` com
 * `keepalive` quando a aba é fechada no meio de uma edição.
 */
export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  let body: SaveBody;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Body inválido" }, { status: 400 });
  }

  const updatedAt = new Date().toISOString();
  const update: {
    name?: string;
    theme?: "light" | "dark";
    cards?: TweetCard[];
    profile_id?: string | null;
    profile?: TweetProfileSnapshot;
    updated_at: string;
  } = { updated_at: updatedAt };

  if (typeof body.name === "string") update.name = body.name.trim().slice(0, 80) || "Carrossel tweet";
  if (body.theme === "light" || body.theme === "dark") update.theme = body.theme;
  if (Array.isArray(body.cards)) {
    update.cards = body.cards.map(cleanCard).filter((c): c is TweetCard => !!c).slice(0, 30);
  }
  if (body.profile && typeof body.profile.name === "string" && typeof body.profile.handle === "string") {
    update.profile = {
      name: body.profile.name.slice(0, 80),
      handle: body.profile.handle.slice(0, 40),
      avatarUrl:
        typeof body.profile.avatarUrl === "string" && /^https?:\/\//.test(body.profile.avatarUrl)
          ? body.profile.avatarUrl
          : null,
    };
    update.profile_id = typeof body.profileId === "string" ? body.profileId : null;
  }

  const { data, error } = await supabase
    .from("tweet_carousels")
    .update(update)
    .eq("id", id)
    .eq("user_id", user.id)
    .select("id")
    .maybeSingle();

  if (error) return NextResponse.json({ error: "Erro ao salvar" }, { status: 500 });
  if (!data) return NextResponse.json({ error: "Carrossel não encontrado" }, { status: 404 });

  return NextResponse.json({ ok: true, updatedAt });
}
