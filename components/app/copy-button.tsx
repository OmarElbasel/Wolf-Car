"use client";

import { Check, Copy } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { Button } from "@/components/ui/button";

export function CopyButton({ value, label }: { value: string; label?: string }) {
  const t = useTranslations("Common");
  const [copied, setCopied] = useState(false);
  return (
    <Button
      variant="outline"
      size="sm"
      onClick={async () => {
        await navigator.clipboard.writeText(value);
        setCopied(true);
        setTimeout(() => setCopied(false), 1600);
      }}
      aria-label={label ?? t("copy")}
    >
      {copied ? <Check className="text-success" aria-hidden="true" /> : <Copy aria-hidden="true" />}
      {copied ? t("copied") : (label ?? t("copy"))}
    </Button>
  );
}
