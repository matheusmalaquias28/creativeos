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
        success: <CircleCheckIcon className="size-4 text-muted-foreground" />,
        info: <InfoIcon className="size-4 text-muted-foreground" />,
        warning: <TriangleAlertIcon className="size-4 text-muted-foreground" />,
        error: <OctagonXIcon className="size-4 text-destructive" />,
        loading: <Loader2Icon className="size-4 animate-spin text-muted-foreground" />,
      }}
      toastOptions={{
        classNames: {
          toast:
            "group toast !rounded-xl !border !border-border !bg-popover !text-foreground !shadow-md dark:!border-white/8 dark:!bg-[oklch(0.1_0.008_265/95%)] dark:!shadow-[0_0_0_1px_oklch(1_0_0/7%),0_8px_32px_oklch(0_0_0/60%)] !backdrop-blur-2xl",
          title: "!text-sm !font-medium",
          description: "!text-xs !text-muted-foreground",
          closeButton:
            "!border-border/50 !bg-transparent !text-muted-foreground hover:!text-foreground",
        },
      }}
      {...props}
    />
  )
}

export { Toaster }
