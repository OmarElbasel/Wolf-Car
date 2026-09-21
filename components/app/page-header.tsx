import type { ReactNode } from "react";

/** Page title block in the same voice as the landing page's SectionHead. */
export function PageHeader({ title, subtitle, actions }: { title: string; subtitle?: string; actions?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div className="max-w-[680px]">
        <h1 className="text-[clamp(24px,4vw,30px)] leading-[1.3] font-extrabold">{title}</h1>
        {subtitle && <p className="mt-1 text-[15px] text-ink-2">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}
