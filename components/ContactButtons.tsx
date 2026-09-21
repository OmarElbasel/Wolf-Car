"use client";

import { useTranslations } from "next-intl";
import { Button } from "./Button";
import { Icon } from "./Icon";
import { useContact } from "./ContactProvider";

export function WhatsAppButton({
  label,
  message,
  variant = "primary",
  size = "md",
  className,
}: {
  label?: string;
  message?: string;
  variant?: "primary" | "outline" | "dark";
  size?: "md" | "sm";
  className?: string;
}) {
  const t = useTranslations("ContactButtons");
  const { ask } = useContact();
  return (
    <Button
      variant={variant}
      size={size}
      className={className}
      onClick={() => ask({ kind: "wa", message })}
    >
      <Icon name="wa" className={variant === "outline" ? "size-5 text-wa" : "size-5"} />
      {label ?? t("whatsappDefault")}
    </Button>
  );
}

export function CallButton({
  label,
  variant = "outline",
  size = "md",
  className,
}: {
  label?: string;
  variant?: "primary" | "outline" | "dark";
  size?: "md" | "sm";
  className?: string;
}) {
  const t = useTranslations("ContactButtons");
  const { ask } = useContact();
  return (
    <Button variant={variant} size={size} className={className} onClick={() => ask({ kind: "call" })}>
      <Icon name="phone" />
      {label ?? t("callDefault")}
    </Button>
  );
}

/** Inline text link that opens the branch picker for a specific topic. */
export function AskLink({ topic, children }: { topic: string; children: React.ReactNode }) {
  const t = useTranslations("ContactButtons");
  const { ask } = useContact();
  return (
    <button
      type="button"
      onClick={() => ask({ kind: "wa", message: t("askTemplate", { topic }) })}
      className="inline-flex min-h-[44px] items-center gap-1.5 font-bold text-accent-ink hover:underline hover:underline-offset-4"
    >
      {children}
    </button>
  );
}
