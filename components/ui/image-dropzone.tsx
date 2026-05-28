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
}: ImageDropzoneProps) {
  const [isDragging, setIsDragging] = useState(false);
  const dragDepth = useRef(0);

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
    sm: "py-6",
    md: "py-10",
    lg: "py-14",
  }[minHeight];

  return (
    <div
      role="region"
      aria-label={title || "Área de upload de imagens"}
      onDragEnter={onDragEnter}
      onDragLeave={onDragLeave}
      onDragOver={onDragOver}
      onDrop={onDrop}
      className={cn(
        "relative flex w-full flex-col items-center justify-center gap-3 rounded-xl border border-dashed px-6 transition-premium",
        heightClass,
        isDragging
          ? "border-foreground/40 bg-accent/20 scale-[1.01]"
          : "border-border/50 bg-card/25",
        disabled || isUploading
          ? "cursor-not-allowed opacity-50"
          : "cursor-default",
        className
      )}
    >
      {children && isDragging && (
        <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center rounded-xl bg-accent/25 backdrop-blur-[2px]">
          <p className="text-sm font-medium text-foreground">
            Solte a imagem aqui
          </p>
        </div>
      )}
      {children ? (
        <div className="pointer-events-none w-full">{children}</div>
      ) : (
        <>
          {isUploading ? (
            <Loader2 className="size-8 animate-spin text-muted-foreground" />
          ) : (
            icon
          )}
          <div className="pointer-events-none text-center">
            <p
              className={cn(
                "text-sm font-medium transition-colors",
                isDragging ? "text-foreground" : "text-foreground/90"
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
