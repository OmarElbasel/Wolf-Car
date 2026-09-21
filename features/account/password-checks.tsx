"use client";

import { Check, Circle, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";
import { checkPasswordRules } from "@/shared/validation";
import { type StrengthScore, usePasswordStrength } from "./use-password-strength";

const METER_COLOR: Record<StrengthScore, string> = {
  0: "bg-danger",
  1: "bg-danger",
  2: "bg-warning",
  3: "bg-success",
  4: "bg-success",
};

const LABEL_COLOR: Record<StrengthScore, string> = {
  0: "text-danger",
  1: "text-danger",
  2: "text-warning",
  3: "text-success",
  4: "text-success",
};

function StrengthMeter({ score }: { score: StrengthScore | null }) {
  const t = useTranslations("Account.password");
  const label = score === null ? undefined : t(`strengthLevels.${score}`);
  return (
    <div className="flex items-center gap-3">
      <div
        role="meter"
        aria-label={t("strength")}
        aria-valuemin={0}
        aria-valuemax={4}
        aria-valuenow={score ?? 0}
        aria-valuetext={label}
        className="grid flex-1 grid-cols-5 gap-1"
      >
        {Array.from({ length: 5 }, (_, i) => (
          <span
            key={i}
            className={cn("h-1.5 rounded-full bg-line transition-colors duration-200", score !== null && i <= score && METER_COLOR[score])}
          />
        ))}
      </div>
      <p className={cn("min-w-28 text-end text-[13px] font-bold", score === null ? "text-muted" : LABEL_COLOR[score])} aria-live="polite">
        {label ? `${t("strength")}: ${label}` : ""}
      </p>
    </div>
  );
}

/**
 * Live password rules (the same checks the API runs) and a zxcvbn strength
 * meter. Each rule carries screen-reader text saying whether it is met.
 */
export function PasswordChecks({
  password,
  username,
  displayName,
  id,
}: {
  password: string;
  username: string;
  displayName?: string;
  id?: string;
}) {
  const t = useTranslations("Account.password");
  const rawScore = usePasswordStrength(password, [username, displayName ?? "", "wolfcar", "wolf car"]);
  const rules = checkPasswordRules(password, username);
  // a password the policy rejects never reads as "strong", whatever its entropy
  const score = rawScore !== null && !rules.every((r) => r.ok) ? (Math.min(rawScore, 2) as StrengthScore) : rawScore;
  return (
    <div id={id} className="grid gap-3 rounded-[var(--radius-brand)] bg-sand p-3.5" data-testid="password-checks">
      {password && <StrengthMeter score={score} />}
      <div>
        <p className="mb-1.5 text-[13px] font-bold text-ink-2">{t("rulesTitle")}</p>
        <ul className="grid gap-x-4 gap-y-1 sm:grid-cols-2">
          {rules.map(({ rule, ok: passes }) => {
            const ok = password.length > 0 && passes;
            return (
              <li key={rule} className="flex items-center gap-2 text-[14px] leading-snug" data-rule={rule} data-ok={ok}>
                {ok ? (
                  <Check className="size-4 shrink-0 text-success" strokeWidth={2.4} aria-hidden="true" />
                ) : password ? (
                  <X className="size-4 shrink-0 text-danger" strokeWidth={2.2} aria-hidden="true" />
                ) : (
                  <Circle className="size-3.5 shrink-0 text-muted" strokeWidth={2} aria-hidden="true" />
                )}
                <span className={ok ? "text-ink" : "text-ink-2"}>{t(`rules.${rule}`)}</span>
                <span className="sr-only">({ok ? t("ruleMet") : t("ruleUnmet")})</span>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}
