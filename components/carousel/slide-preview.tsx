"use client";

import { cn } from "@/lib/utils";
import type { CarouselFormat, CarouselSlide } from "@/types/carousel";

export const FORMAT_DIMENSIONS: Record<
  CarouselFormat,
  { width: number; height: number }
> = {
  carousel: { width: 1080, height: 1350 },
  square: { width: 1080, height: 1080 },
  stories: { width: 1080, height: 1920 },
};

export const FORMAT_LABELS: Record<CarouselFormat, string> = {
  carousel: "Carrossel 4:5",
  square: "Quadrado 1:1",
  stories: "Stories 9:16",
};

interface SlidePreviewProps {
  slide: CarouselSlide;
  format: CarouselFormat;
  previewWidth?: number;
  className?: string;
  innerRef?: React.RefObject<HTMLDivElement | null>;
}

export function SlidePreview({
  slide,
  format,
  previewWidth = 270,
  className,
  innerRef,
}: SlidePreviewProps) {
  const dims = FORMAT_DIMENSIONS[format];
  const scale = previewWidth / dims.width;
  const previewHeight = Math.round(dims.height * scale);

  const posX = slide.imagemPosX ?? 50;
  const posY = slide.imagemPosY ?? 50;
  const zoom = slide.imagemZoom ?? 150;

  return (
    <div
      className={cn("relative shrink-0 overflow-hidden select-none", className)}
      style={{ width: previewWidth, height: previewHeight }}
    >
      <div
        ref={innerRef}
        style={{
          width: dims.width,
          height: dims.height,
          transform: `scale(${scale})`,
          transformOrigin: "top left",
          position: "absolute",
          top: 0,
          left: 0,
          overflow: "hidden",
          backgroundColor: slide.corFundo,
          fontFamily: '"Manrope", "Inter", system-ui, sans-serif',
          ...(slide.imagemFundo
            ? {
                backgroundImage: `url(${slide.imagemFundo})`,
                backgroundSize: `${zoom}%`,
                backgroundPosition: `${posX}% ${posY}%`,
                backgroundRepeat: "no-repeat",
              }
            : {}),
        }}
      >
        {/* Gradient overlay */}
        {slide.imagemFundo && slide.overlayOpacidade > 0 && (
          <div
            style={{
              position: "absolute",
              inset: 0,
              background:
                "linear-gradient(to top, rgba(0,0,0,1) 0%, rgba(0,0,0,0.45) 55%, rgba(0,0,0,0) 100%)",
              opacity: slide.overlayOpacidade / 100,
            }}
          />
        )}

        {/* Text block — bottom left */}
        <div
          style={{
            position: "absolute",
            bottom: 100,
            left: 72,
            right: 72,
          }}
        >
          {slide.titulo ? (
            <h2
              style={{
                color: slide.corTitulo,
                fontSize: slide.tamanhoTitulo,
                fontWeight: 800,
                lineHeight: 1.05,
                margin: 0,
                marginBottom: 24,
                letterSpacing: "-0.02em",
                wordBreak: "break-word",
              }}
            >
              {slide.titulo}
            </h2>
          ) : (
            <h2
              style={{
                color: "rgba(255,255,255,0.15)",
                fontSize: slide.tamanhoTitulo,
                fontWeight: 800,
                lineHeight: 1.05,
                margin: 0,
                marginBottom: 24,
                letterSpacing: "-0.02em",
              }}
            >
              Título do slide
            </h2>
          )}

          {slide.subtitulo && (
            <p
              style={{
                color: slide.corSubtitulo,
                fontSize: slide.tamanhoSubtitulo,
                fontWeight: 400,
                lineHeight: 1.5,
                margin: 0,
                wordBreak: "break-word",
              }}
            >
              {slide.subtitulo}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
