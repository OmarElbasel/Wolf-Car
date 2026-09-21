"use client"

import { CircleCheckIcon, InfoIcon, Loader2Icon, OctagonXIcon, TriangleAlertIcon } from "lucide-react"
import { Toaster as Sonner, type ToasterProps } from "sonner"
import { useDarkMode } from "@/hooks/use-dark-mode"

/** Toasts styled with the site tokens and following the site's dark-mode class. */
const Toaster = ({ ...props }: ToasterProps) => {
  const dark = useDarkMode()
  return (
    <Sonner
      theme={dark ? "dark" : "light"}
      className="toaster group"
      position="top-center"
      icons={{
        success: <CircleCheckIcon className="size-[18px] text-success" />,
        info: <InfoIcon className="size-[18px]" />,
        warning: <TriangleAlertIcon className="size-[18px] text-warning" />,
        error: <OctagonXIcon className="size-[18px] text-danger" />,
        loading: <Loader2Icon className="size-[18px] animate-spin" />,
      }}
      style={
        {
          "--normal-bg": "var(--t-surface)",
          "--normal-text": "var(--t-ink)",
          "--normal-border": "var(--t-line)",
          "--border-radius": "10px",
          fontFamily: "inherit",
        } as React.CSSProperties
      }
      toastOptions={{ classNames: { toast: "font-sans !text-[15px] !font-semibold" } }}
      {...props}
    />
  )
}

export { Toaster }
