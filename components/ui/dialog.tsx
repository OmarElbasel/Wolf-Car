"use client"

import * as React from "react"
import { AnimatePresence, motion } from "motion/react"
import { Dialog as DialogPrimitive } from "radix-ui"
import { XIcon } from "lucide-react"
import { Button } from "@/components/ui/button"
import { fade, pop } from "@/lib/motion"
import { cn } from "@/lib/utils"

/**
 * shadcn Dialog, animated with Motion: the parts are force-mounted and
 * AnimatePresence plays the exit before Radix unmounts them. Works controlled
 * (open/onOpenChange) or uncontrolled (defaultOpen).
 */
const DialogOpenContext = React.createContext(false)

function Dialog({
  open: openProp,
  defaultOpen = false,
  onOpenChange,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Root>) {
  const [uncontrolled, setUncontrolled] = React.useState(defaultOpen)
  const open = openProp ?? uncontrolled
  const setOpen = React.useCallback(
    (next: boolean) => {
      if (openProp === undefined) setUncontrolled(next)
      onOpenChange?.(next)
    },
    [openProp, onOpenChange]
  )
  return (
    <DialogOpenContext.Provider value={open}>
      <DialogPrimitive.Root data-slot="dialog" open={open} onOpenChange={setOpen} {...props} />
    </DialogOpenContext.Provider>
  )
}

function DialogTrigger({ ...props }: React.ComponentProps<typeof DialogPrimitive.Trigger>) {
  return <DialogPrimitive.Trigger data-slot="dialog-trigger" {...props} />
}

function DialogPortal({ ...props }: React.ComponentProps<typeof DialogPrimitive.Portal>) {
  return <DialogPrimitive.Portal data-slot="dialog-portal" {...props} />
}

function DialogClose({ ...props }: React.ComponentProps<typeof DialogPrimitive.Close>) {
  return <DialogPrimitive.Close data-slot="dialog-close" {...props} />
}

function DialogOverlay({ className }: { className?: string }) {
  return (
    <DialogPrimitive.Overlay forceMount asChild>
      <motion.div
        data-slot="dialog-overlay"
        className={cn("fixed inset-0 isolate z-50 bg-black/45", className)}
        {...fade}
      />
    </DialogPrimitive.Overlay>
  )
}

function DialogContent({
  className,
  children,
  showCloseButton = true,
  closeLabel = "Close",
  ...props
}: Omit<React.ComponentProps<typeof DialogPrimitive.Content>, "asChild" | "forceMount"> & {
  showCloseButton?: boolean
  closeLabel?: string
}) {
  const open = React.useContext(DialogOpenContext)
  return (
    <AnimatePresence>
      {open && (
        <DialogPortal forceMount>
          <DialogOverlay />
          <DialogPrimitive.Content forceMount asChild {...props}>
            <motion.div
              data-slot="dialog-content"
              className={cn(
                "fixed top-1/2 start-1/2 z-50 grid max-h-[calc(100dvh-2rem)] w-full max-w-[calc(100%-2rem)] -translate-x-1/2 -translate-y-1/2 gap-4 overflow-y-auto rounded-[var(--radius-brand-lg)] border border-line bg-surface p-5 text-[15px] text-ink outline-none rtl:translate-x-1/2 sm:max-w-md",
                className
              )}
              {...pop}
            >
              {children}
              {showCloseButton && (
                <DialogPrimitive.Close data-slot="dialog-close" asChild>
                  <Button variant="ghost" className="absolute top-2.5 end-2.5" size="icon-sm">
                    <XIcon />
                    <span className="sr-only">{closeLabel}</span>
                  </Button>
                </DialogPrimitive.Close>
              )}
            </motion.div>
          </DialogPrimitive.Content>
        </DialogPortal>
      )}
    </AnimatePresence>
  )
}

function DialogHeader({ className, ...props }: React.ComponentProps<"div">) {
  return <div data-slot="dialog-header" className={cn("flex flex-col gap-1.5 pe-8", className)} {...props} />
}

function DialogFooter({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="dialog-footer"
      className={cn("flex flex-col-reverse gap-2 pt-1 sm:flex-row sm:justify-end", className)}
      {...props}
    />
  )
}

function DialogTitle({ className, ...props }: React.ComponentProps<typeof DialogPrimitive.Title>) {
  return (
    <DialogPrimitive.Title
      data-slot="dialog-title"
      className={cn("text-lg leading-snug font-extrabold", className)}
      {...props}
    />
  )
}

function DialogDescription({ className, ...props }: React.ComponentProps<typeof DialogPrimitive.Description>) {
  return (
    <DialogPrimitive.Description
      data-slot="dialog-description"
      className={cn("text-[15px] text-ink-2", className)}
      {...props}
    />
  )
}

export {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogOverlay,
  DialogPortal,
  DialogTitle,
  DialogTrigger,
}
