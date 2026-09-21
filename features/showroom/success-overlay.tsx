"use client";

import { ArrowRight } from "lucide-react";
import { motion } from "motion/react";
import { useLocale, useTranslations } from "next-intl";
import { useEffect, useEffectEvent, useId } from "react";
import { Button } from "@/components/ui/button";
import type { OrderDetail } from "@/lib/api/types";
import { formatMoney } from "@/lib/format";
import { EASE_OUT, fade, spring } from "@/lib/motion";

/** How long the confirmation stays up before the kiosk resets for the next customer. */
export const SUCCESS_RESET_MS = 6_000;

function SuccessCheck() {
  return (
    <motion.svg
      viewBox="0 0 96 96"
      className="size-24 text-success"
      aria-hidden="true"
      initial={{ scale: 0.6, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={spring}
    >
      <circle cx="48" cy="48" r="46" className="fill-success-soft" />
      <motion.path
        d="M29 50 L42 63 L68 35"
        fill="none"
        stroke="currentColor"
        strokeWidth={7}
        strokeLinecap="round"
        strokeLinejoin="round"
        initial={{ pathLength: 0 }}
        animate={{ pathLength: 1 }}
        transition={{ duration: 0.36, delay: 0.14, ease: EASE_OUT }}
      />
    </motion.svg>
  );
}

/**
 * Full-screen "order placed" confirmation with the order code in large type.
 * Resets the kiosk on "Next customer" or automatically after a few seconds.
 */
export function SuccessOverlay({ order, onDone }: { order: OrderDetail; onDone: () => void }) {
  const t = useTranslations("Showroom");
  const locale = useLocale();
  const titleId = useId();
  const done = useEffectEvent(() => onDone());

  useEffect(() => {
    const id = setTimeout(() => done(), SUCCESS_RESET_MS);
    return () => clearTimeout(id);
  }, []);

  return (
    <motion.div
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      className="fixed inset-0 z-[60] grid place-items-center overflow-y-auto bg-sand px-5 py-10"
      {...fade}
    >
      <div className="grid w-full max-w-xl justify-items-center gap-5 text-center">
        <SuccessCheck />
        <div>
          <h2 id={titleId} className="text-[clamp(28px,4vw,36px)] leading-tight font-extrabold">
            {t("successTitle")}
          </h2>
          <p className="mt-1 text-[17px] text-ink-2">
            <span dir="auto">{order.customerName}</span>
            <span aria-hidden="true"> · </span>
            <span dir="ltr" className="font-bold text-ink tabular-nums">
              {formatMoney(order.total, locale)}
            </span>
          </p>
        </div>
        <motion.div
          className="w-full rounded-[var(--radius-brand-lg)] border border-line bg-surface px-6 py-6"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.22, delay: 0.2, ease: EASE_OUT }}
        >
          <p className="text-sm font-bold text-muted">{t("orderNumber")}</p>
          <p
            dir="ltr"
            className="font-mono text-[clamp(40px,8vw,64px)] leading-tight font-extrabold tracking-wide text-ink"
            data-testid="order-code"
            aria-live="assertive"
          >
            {order.code}
          </p>
          <p className="mt-2 text-[17px] text-ink-2">{t("successBody")}</p>
        </motion.div>
        <Button size="touch" className="min-w-72" autoFocus onClick={onDone}>
          {t("nextCustomer")}
          <ArrowRight className="rtl:-scale-x-100" aria-hidden="true" />
        </Button>
        <p className="text-sm text-muted">{t("successHint")}</p>
      </div>
    </motion.div>
  );
}
