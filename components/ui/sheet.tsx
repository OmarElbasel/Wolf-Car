"use client"

import * as React from "react"
import { AnimatePresence, motion } from "motion/react"
import { Dialog as SheetPrimitive, Direction } from "radix-ui"
import { XIcon } from "lucide-react"
import { Button } from "@/components/ui/button"
import { base, fade } from "@/lib/motion"
import { cn } from "@/lib/utils"

/**
 * shadcn Sheet (drawer) animated with Motion. `side` is logical: "end" is the
 * right edge in LTR and the left edge in RTL (Arabic).
 */
const SheetOpenContext = React.createContext(false)

type Side = "start" | "end" | "top" | "bottom"

function Sheet({
  open: openProp,
  defaultOpen = false,
  onOpenChange,
  ...props
}: React.ComponentProps<typeof SheetPrimitive.Root>) {
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
    <SheetOpenContext.Provider value={open}>
      <SheetPrimitive.Root data-slot="sheet" open={open} onOpenChange={setOpen} {...props} />
    </SheetOpenContext.Provider>
  )
}

function SheetTrigger({ ...props }: React.ComponentProps<typeof SheetPrimitive.Trigger>) {
  return <SheetPrimitive.Trigger data-slot="sheet-trigger" {...props} />
}

function SheetClose({ ...props }: React.ComponentProps<typeof SheetPrimitive.Close>) {
  return <SheetPrimitive.Close data-slot="sheet-close" {...props} />
}

const SIDE_CLASS: Record<Side, string> = {
  end: "inset-y-0 end-0 h-full w-[92%] max-w-lg border-s",
  start: "inset-y-0 start-0 h-full w-[92%] max-w-lg border-e",
  top: "inset-x-0 top-0 max-h-[90dvh] border-b rounded-b-[var(--radius-brand-lg)]",
  bottom: "inset-x-0 bottom-0 max-h-[92dvh] border-t rounded-t-[var(--radius-brand-lg)] pb-[env(safe-area-inset-bottom)]",
}

function offset(side: Side, rtl: boolean) {
  if (side === "top") return { y: "-100%" }
  if (side === "bottom") return { y: "100%" }
  const towardsRight = (side === "end") !== rtl
  return { x: towardsRight ? "100%" : "-100%" }
}

function SheetContent({
  className,
  children,
  side = "end",
  showCloseButton = true,
  closeLabel = "Close",
  ...props
}: Omit<React.ComponentProps<typeof SheetPrimitive.Content>, "asChild" | "forceMount"> & {
  side?: Side
  showCloseButton?: boolean
  closeLabel?: string
}) {
  const open = React.useContext(SheetOpenContext)
  const rtl = Direction.useDirection() === "rtl"
  const hidden = offset(side, rtl)
  return (
    <AnimatePresence>
      {open && (
        <SheetPrimitive.Portal forceMount>
          <SheetPrimitive.Overlay forceMount asChild>
            <motion.div data-slot="sheet-overlay" className="fixed inset-0 z-50 bg-black/45" {...fade} />
          </SheetPrimitive.Overlay>
          <SheetPrimitive.Content forceMount asChild {...props}>
            <motion.div
              data-slot="sheet-content"
              data-side={side}
              className={cn(
                "fixed z-50 flex flex-col gap-4 overflow-y-auto border-line bg-surface text-[15px] text-ink outline-none",
                SIDE_CLASS[side],
                className
              )}
              initial={hidden}
              animate={{ x: 0, y: 0 }}
              exit={hidden}
              transition={base}
            >
              {children}
              {showCloseButton && (
                <SheetPrimitive.Close data-slot="sheet-close" asChild>
                  <Button variant="ghost" className="absolute top-3 end-3" size="icon-sm">
                    <XIcon />
                    <span className="sr-only">{closeLabel}</span>
                  </Button>
                </SheetPrimitive.Close>
              )}
            </motion.div>
          </SheetPrimitive.Content>
        </SheetPrimitive.Portal>
      )}
    </AnimatePresence>
  )
}

function SheetHeader({ className, ...props }: React.ComponentProps<"div">) {
  return <div data-slot="sheet-header" className={cn("flex flex-col gap-1 px-5 pt-5 pe-14", className)} {...props} />
}

function SheetBody({ className, ...props }: React.ComponentProps<"div">) {
  return <div data-slot="sheet-body" className={cn("flex-1 px-5", className)} {...props} />
}

function SheetFooter({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="sheet-footer"
      className={cn("sticky bottom-0 mt-auto flex flex-col gap-2 border-t border-line bg-surface px-5 py-4 sm:flex-row sm:justify-end", className)}
      {...props}
    />
  )
}

function SheetTitle({ className, ...props }: React.ComponentProps<typeof SheetPrimitive.Title>) {
  return (
    <SheetPrimitive.Title data-slot="sheet-title" className={cn("text-lg font-extrabold text-ink", className)} {...props} />
  )
}

function SheetDescription({ className, ...props }: React.ComponentProps<typeof SheetPrimitive.Description>) {
  return (
    <SheetPrimitive.Description data-slot="sheet-description" className={cn("text-sm text-ink-2", className)} {...props} />
  )
}

export { Sheet, SheetBody, SheetClose, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle, SheetTrigger }
