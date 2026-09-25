"use client"

import { useTheme } from "next-themes"
import { Toaster as Sonner, type ToasterProps } from "sonner"
import {
  CircleCheckIcon,
  InfoIcon,
  TriangleAlertIcon,
  OctagonXIcon,
  Loader2Icon,
} from "lucide-react"

const Toaster = ({ ...props }: ToasterProps) => {
  const { resolvedTheme } = useTheme()

  return (
    <Sonner
      theme={resolvedTheme === "dark" ? "dark" : "light"}
      className="toaster group"
      icons={{
        success: <CircleCheckIcon className="size-4 text-tone-green" />,
        info: <InfoIcon className="size-4 text-tone-blue" />,
        warning: <TriangleAlertIcon className="size-4 text-tone-amber" />,
        error: <OctagonXIcon className="size-4 text-tone-red" />,
        loading: <Loader2Icon className="size-4 animate-spin text-muted-foreground" />,
      }}
      toastOptions={{
        classNames: {
          toast:
            "group toast !rounded-2xl !border !border-border !bg-popover !text-foreground !shadow-[var(--surface-shadow-elevated)]",
          title: "!text-sm !font-medium",
          description: "!text-xs !text-muted-foreground",
          closeButton:
            "!border-border !bg-popover !text-muted-foreground hover:!text-foreground",
        },
      }}
      {...props}
    />
  )
}

export { Toaster }
