import { NextRequest } from "next/server";
import pLimit from "p-limit";
import { createClient } from "@/lib/supabase/server";
import {
  specToSlide,
  imagesNeeded,
  applyImageToSlide,
  slotAspect,
  type TurboSpec,
} from "@/lib/carousel/turbo/schema";
import { generateMagnificImage, ASPECT_BY_FORMAT } from "@/lib/carousel/turbo/magnific";
import { withPtBrImagePrompt } from "@/lib/carousel/image-prompt";
import { makeDefaultDesign } from "@/types/carousel";
import type { CarouselProfile } from "@/types/carousel-profile";

export const maxDuration = 300;

const IMAGE_CAP = 12;

type BuildBody = { profileId: string; spec: TurboSpec; theme?: string };

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return new Response(JSON.stringify({ error: "Não autenticado" }), { status: 401 });

  let body: BuildBody;
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: "Body inválido" }), { status: 400 });
  }
  const spec = body.spec;
  if (!body.profileId || !spec || !Array.isArray(spec.slides) || spec.slides.length === 0) {
    return new Response(JSON.stringify({ error: "Perfil e conteúdo são obrigatórios" }), { status: 400 });
  }

  const { data: profileData } = await supabase
    .from("carousel_profiles")
    .select("*")
    .eq("id", body.profileId)
    .single();
  const profile = profileData as CarouselProfile | null;
  if (!profile) return new Response(JSON.stringify({ error: "Perfil não encontrado" }), { status: 404 });

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      const send = (obj: unknown) =>
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(obj)}\n\n`));

      try {
        const format = "carousel" as const;
        const slides = spec.slides.map((s) => specToSlide(s, [], profile));
        const design = makeDefaultDesign();
        if (profile.logo_url) {
          design.badge.enabled = true;
          design.badge.logoUrl = profile.logo_url;
          design.badge.handle = profile.instagram_handle ?? "";
        }
        design.numbering.enabled = true;

        const { data: created, error: insErr } = await supabase
          .from("carousels")
          .insert({
            user_id: user.id,
            name: `Turbo — ${(body.theme ?? spec.slides[0]?.titulo ?? "carrossel").slice(0, 48)}`,
            format,
            post_style: "minimal",
            slides,
            design,
          })
          .select("id")
          .single();

        if (insErr || !created) {
          send({ type: "error", message: insErr?.message ?? "Falha ao criar o carrossel" });
          controller.close();
          return;
        }
        const carouselId = created.id;

        // Build capped jobs; compute how many images each slide will receive.
        // Grid slots use an aspect ratio that matches their cell (less cropping).
        type Job = { si: number; k: number; prompt: string; aspect: string };
        const jobs: Job[] = [];
        spec.slides.forEach((s, si) => {
          const need = imagesNeeded(s);
          const prompts = [s.bgPrompt, ...(s.gridPrompts ?? [])];
          for (let k = 0; k < need; k++) {
            const aspect =
              s.layout === "background" ? ASPECT_BY_FORMAT[format] : slotAspect(s.layout, k);
            jobs.push({ si, k, prompt: prompts[k] ?? s.bgPrompt, aspect });
          }
        });
        const capped = jobs.slice(0, IMAGE_CAP);
        const expected = slides.map(() => 0);
        capped.forEach((j) => (expected[j.si] += 1));

        // Carousel already saved — tell the client to render the cards live.
        send({ type: "created", carouselId, slides, design, expected });

        const persist = () =>
          supabase
            .from("carousels")
            .update({ slides, updated_at: new Date().toISOString() })
            .eq("id", carouselId)
            .eq("user_id", user.id)
            .then(() => undefined, () => undefined);

        const DEADLINE = Date.now() + 250_000;
        const limit = pLimit(4);
        let done = 0;
        let failed = 0;
        let firstReason: string | undefined;
        await Promise.all(
          capped.map((job) =>
            limit(async () => {
              let url: string | null = null;
              let reason: string | undefined;

              if (Date.now() >= DEADLINE) {
                reason = "tempo do processo esgotado";
              } else {
                const finalPrompt = withPtBrImagePrompt(job.prompt);
                let r = await generateMagnificImage(finalPrompt, job.aspect);
                // One retry on a real failure while there is still time budget.
                if (!r.url && Date.now() < DEADLINE - 85_000) {
                  r = await generateMagnificImage(finalPrompt, job.aspect);
                }
                url = r.url;
                reason = r.reason;
              }

              if (url) {
                applyImageToSlide(slides[job.si], job.k, url);
                await persist();
              } else {
                failed++;
                if (!firstReason) firstReason = reason;
                console.error("[turbo] image failed", { si: job.si, k: job.k, reason });
              }
              done++;
              send({
                type: "image",
                si: job.si,
                k: job.k,
                url,
                reason: url ? undefined : reason,
                done,
                total: capped.length,
              });
            })
          )
        );

        await persist();
        send({ type: "done", carouselId, imagesFailed: failed, failReason: firstReason });
      } catch (e) {
        send({ type: "error", message: e instanceof Error ? e.message : "Erro ao montar" });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
