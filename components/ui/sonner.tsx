"use client"

import { Toaster as Sonner, type ToasterProps } from "sonner"
import {
  CircleCheckIcon,
  InfoIcon,
  TriangleAlertIcon,
  OctagonXIcon,
  Loader2Icon,
} from "lucide-react"

const Toaster = ({ ...props }: ToasterProps) => {
  return (
    <Sonner
      theme="dark"
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
            "group toast !rounded-lg !border !border-border/50 !bg-popover/95 !text-foreground !shadow-none !backdrop-blur-md",
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
