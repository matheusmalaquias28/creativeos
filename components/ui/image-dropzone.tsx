"use client";

import { useCallback, useRef, useState, type ReactNode } from "react";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

function filterImageFiles(files: FileList | File[], accept: string): File[] {
  const acceptTypes = accept
    .split(",")
    .map((t) => t.trim())
    .filter(Boolean);

  return Array.from(files).filter((file) => {
    if (!file.type.startsWith("image/")) return false;
    if (acceptTypes.length === 0) return true;
    return acceptTypes.some(
      (type) =>
        file.type === type ||
        (type.endsWith("/*") && file.type.startsWith(type.replace("/*", "/")))
    );
  });
}

type ImageDropzoneProps = {
  onFiles: (files: File[]) => void;
  accept?: string;
  multiple?: boolean;
  disabled?: boolean;
  isUploading?: boolean;
  icon?: ReactNode;
  title: string;
  subtitle?: string;
  className?: string;
  minHeight?: "sm" | "md" | "lg";
  children?: ReactNode;
  variant?: "default" | "neon";
};

export function ImageDropzone({
  onFiles,
  accept = "image/jpeg,image/png,image/webp,image/gif",
  multiple = false,
  disabled = false,
  isUploading = false,
  icon,
  title,
  subtitle,
  className,
  minHeight = "md",
  children,
  variant = "default",
}: ImageDropzoneProps) {
  const [isDragging, setIsDragging] = useState(false);
  const dragDepth = useRef(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFiles = useCallback(
    (incoming: FileList | File[]) => {
      const filtered = filterImageFiles(incoming, accept);
      if (filtered.length === 0) return;
      onFiles(multiple ? filtered : [filtered[0]]);
    },
    [accept, multiple, onFiles]
  );

  const onDragEnter = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (disabled || isUploading) return;
    dragDepth.current += 1;
    if (e.dataTransfer.types.includes("Files")) {
      setIsDragging(true);
    }
  };

  const onDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragDepth.current -= 1;
    if (dragDepth.current <= 0) {
      dragDepth.current = 0;
      setIsDragging(false);
    }
  };

  const onDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (disabled || isUploading) return;
    e.dataTransfer.dropEffect = "copy";
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragDepth.current = 0;
    setIsDragging(false);
    if (disabled || isUploading) return;
    handleFiles(e.dataTransfer.files);
  };

  const heightClass = {
    sm: "min-h-28 py-5",
    md: "min-h-36 py-8",
    lg: "min-h-44 py-12",
  }[minHeight];

  const interactive = !disabled && !isUploading;

  return (
    <div
      role="button"
      tabIndex={interactive ? 0 : -1}
      aria-label={title || "Área de upload de imagens"}
      onClick={() => {
        if (!interactive) return;
        inputRef.current?.click();
      }}
      onKeyDown={(e) => {
        if (!interactive) return;
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          inputRef.current?.click();
        }
      }}
      onDragEnter={onDragEnter}
      onDragLeave={onDragLeave}
      onDragOver={onDragOver}
      onDrop={onDrop}
      className={cn(
        "relative flex w-full flex-col items-center justify-center gap-2.5 rounded-2xl border border-dashed px-5 outline-none transition-premium",
        heightClass,
        variant === "neon" && "dropzone-neon",
        variant === "neon" && isDragging && "dropzone-neon-active",
        variant === "default" &&
          (isDragging
            ? "border-foreground/40 bg-accent/20"
            : "border-border/50 bg-card/25"),
        interactive
          ? "cursor-pointer hover:border-white/30"
          : "cursor-not-allowed opacity-50",
        className
      )}
    >
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        multiple={multiple}
        className="sr-only"
        disabled={!interactive}
        onChange={(e) => {
          if (e.target.files) handleFiles(e.target.files);
          e.target.value = "";
        }}
      />
      {children && isDragging && (
        <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center rounded-2xl bg-white/6 backdrop-blur-[2px]">
          <p className="text-sm font-medium text-foreground">Solte a imagem aqui</p>
        </div>
      )}
      {children ? (
        <div className="pointer-events-none w-full">{children}</div>
      ) : (
        <>
          {isUploading ? (
            <Loader2 className="size-6 animate-spin text-muted-foreground" />
          ) : (
            icon
          )}
          <div className="pointer-events-none text-center">
            <p
              className={cn(
                "text-sm font-medium transition-colors",
                isDragging ? "text-foreground" : "text-foreground/80"
              )}
            >
              {isDragging ? "Solte as imagens aqui" : title}
            </p>
            {subtitle && (
              <p className="mt-1 text-xs text-muted-foreground">{subtitle}</p>
            )}
          </div>
        </>
      )}
    </div>
  );
}
