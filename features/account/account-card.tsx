import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { useId } from "react";

/** A settings section on the account page, in the site's flat card style. */
export function AccountCard({
  icon: Icon,
  title,
  body,
  badge,
  children,
}: {
  icon: LucideIcon;
  title: string;
  body?: ReactNode;
  badge?: ReactNode;
  children: ReactNode;
}) {
  const titleId = useId();
  return (
    <section aria-labelledby={titleId} className="rounded-[var(--radius-brand-lg)] border border-line bg-surface p-5">
      <div className="mb-4 flex items-start gap-3">
        <span className="grid size-11 shrink-0 place-items-center rounded-[var(--radius-brand)] bg-sand text-accent-ink">
          <Icon className="size-[22px]" strokeWidth={1.8} aria-hidden="true" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h2 id={titleId} className="text-lg leading-snug font-extrabold">
              {title}
            </h2>
            {badge}
          </div>
          {body && <p className="mt-0.5 text-[15px] text-ink-2">{body}</p>}
        </div>
      </div>
      {children}
    </section>
  );
}
