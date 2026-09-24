import type { AnchorHTMLAttributes, ButtonHTMLAttributes, ReactNode } from "react";

type Variant = "primary" | "outline" | "dark";
type Size = "md" | "sm";

/** Flat only. No glow, no coloured shadows, no pills — that reads as AI-made. */
const BASE =
  "inline-flex items-center justify-center gap-2 rounded-[var(--radius-brand)] font-bold " +
  "whitespace-nowrap transition-colors duration-150 touch-manipulation";

const VARIANTS: Record<Variant, string> = {
  primary: "bg-accent text-white hover:bg-accent-dark",
  dark: "bg-charcoal text-white hover:bg-black",
  outline: "bg-transparent text-ink border-[1.5px] border-[#CFCBC4] dark:border-[#3a3733] hover:border-ink",
};

const SIZES: Record<Size, string> = {
  md: "min-h-[50px] px-[22px] text-[17px]",
  sm: "min-h-[44px] px-[14px] text-[15px]",
};

export function buttonClass(variant: Variant = "primary", size: Size = "md", extra = "") {
  return `${BASE} ${VARIANTS[variant]} ${SIZES[size]} ${extra}`.trim();
}

interface Common {
  variant?: Variant;
  size?: Size;
  className?: string;
  children: ReactNode;
}

export function Button({
  variant,
  size,
  className,
  children,
  ...rest
}: Common & ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button type="button" className={buttonClass(variant, size, className)} {...rest}>
      {children}
    </button>
  );
}

export function ButtonLink({
  variant,
  size,
  className,
  children,
  ...rest
}: Common & AnchorHTMLAttributes<HTMLAnchorElement>) {
  return (
    <a className={buttonClass(variant, size, className)} {...rest}>
      {children}
    </a>
  );
}

export function Wrap({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`mx-auto w-full max-w-[1160px] px-5 ${className}`}>{children}</div>;
}

export function SectionHead({
  label,
  title,
  body,
  id,
  tone = "light",
  center = false,
}: {
  label: string;
  title: string;
  body?: string;
  id?: string;
  tone?: "light" | "dark";
  center?: boolean;
}) {
  return (
    <div className={`mb-7 max-w-[620px] ${center ? "mx-auto text-center" : ""}`}>
      <div className={`text-sm font-bold ${tone === "dark" ? "text-[#FF9A62]" : "text-accent-ink"}`}>
        {label}
      </div>
      <h2 id={id} className="mt-1 mb-2 text-[clamp(25px,5.6vw,36px)] leading-[1.3] font-extrabold">
        {title}
      </h2>
      {body && <p className={tone === "dark" ? "text-[#C9C9C9]" : "text-ink-2"}>{body}</p>}
    </div>
  );
}

/** Grey box standing in for a photo we do not have yet. */
export function Photo({ label, dark = false }: { label: string; dark?: boolean }) {
  return (
    <div
      className={`grid size-full place-items-center p-3 text-center text-sm font-semibold ${
        dark ? "bg-[#262626] text-[#9C9C9C]" : "bg-[#E9E6E0] text-[#7A766F] dark:bg-[#2a2822] dark:text-[#8f8a80]"
      }`}
    >
      {label}
    </div>
  );
}
