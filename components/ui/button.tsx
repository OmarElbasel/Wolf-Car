import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { Slot } from "radix-ui"
import { cn } from "@/lib/utils"

/**
 * Mirrors components/Button.tsx from the landing page: flat, bold, 10px radius,
 * 44–50px targets. No glow, no coloured shadows, no pills.
 */
const buttonVariants = cva(
  "inline-flex shrink-0 cursor-pointer items-center justify-center gap-2 rounded-[var(--radius-brand)] font-bold whitespace-nowrap transition-colors duration-150 touch-manipulation outline-none select-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-ink disabled:pointer-events-none disabled:opacity-50 aria-invalid:border-danger [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-[18px]",
  {
    variants: {
      variant: {
        default: "bg-accent text-white hover:bg-accent-dark",
        dark: "bg-charcoal text-white hover:bg-black dark:bg-[#2a2723] dark:hover:bg-[#35312c]",
        outline:
          "border-[1.5px] border-[#CFCBC4] bg-transparent text-ink hover:border-ink dark:border-[#3a3733] dark:hover:border-ink-2",
        secondary: "bg-sand text-ink hover:bg-[#ebe8e2] dark:hover:bg-[#24211c]",
        ghost: "text-ink-2 hover:bg-sand hover:text-ink",
        destructive: "bg-danger text-surface hover:opacity-90",
        "destructive-outline": "border-[1.5px] border-danger/40 bg-transparent text-danger hover:bg-danger-soft",
        link: "text-accent-ink underline-offset-4 hover:underline",
      },
      size: {
        default: "min-h-11 px-[14px] text-[15px]",
        sm: "min-h-9 rounded-[8px] px-3 text-sm",
        xs: "min-h-7 gap-1 rounded-[6px] px-2 text-xs [&_svg:not([class*='size-'])]:size-3.5",
        lg: "min-h-[50px] px-[22px] text-[17px]",
        /** showroom kiosk: large tap targets */
        touch: "min-h-[60px] px-6 text-lg [&_svg:not([class*='size-'])]:size-6",
        icon: "size-11",
        "icon-sm": "size-9 rounded-[8px]",
        "icon-lg": "size-[50px]",
        "icon-touch": "size-[60px] [&_svg:not([class*='size-'])]:size-6",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

function Button({
  className,
  variant = "default",
  size = "default",
  asChild = false,
  type,
  ...props
}: React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean
  }) {
  const Comp = asChild ? Slot.Root : "button"

  return (
    <Comp
      data-slot="button"
      data-variant={variant}
      data-size={size}
      className={cn(buttonVariants({ variant, size, className }))}
      {...(asChild ? {} : { type: type ?? "button" })}
      {...props}
    />
  )
}

export { Button, buttonVariants }
