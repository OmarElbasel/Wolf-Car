import { getTranslations } from "next-intl/server";
import { CallButton, WhatsAppButton } from "./ContactButtons";

/** Mobile only — hidden from md up, where the header CTA takes over. */
export async function StickyBar() {
  const t = await getTranslations("StickyBar");
  const common = await getTranslations("Common");

  return (
    <div
      role="region"
      aria-label={t("aria")}
      className="fixed inset-x-0 bottom-0 z-60 grid grid-cols-2 gap-2 border-t border-line bg-surface px-3 pt-2 pb-[calc(8px+env(safe-area-inset-bottom))] md:hidden"
    >
      <WhatsAppButton label={common("whatsapp")} className="min-h-12 text-base" />
      <CallButton label={common("call")} className="min-h-12 text-base" />
    </div>
  );
}
