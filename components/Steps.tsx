import { CalendarCheck, MessageCircle, Wrench, type LucideIcon } from "lucide-react";
import { getLocale, getTranslations } from "next-intl/server";
import { SectionHead, Wrap } from "./Button";
import { getSteps } from "@/lib/content";

const ICONS: LucideIcon[] = [MessageCircle, CalendarCheck, Wrench];

/** Dashed link between two step circles; alternates dipping down and arching up. */
function Connector({ up }: { up: boolean }) {
  return (
    <svg
      viewBox="0 0 120 30"
      fill="none"
      aria-hidden="true"
      className="pointer-events-none absolute start-[calc(50%+92px)] top-[58px] hidden h-[30px] w-[calc(100%-184px)] text-[#BDB8B0] lg:block dark:text-[#55524c]"
      preserveAspectRatio="none"
    >
      <path
        d={up ? "M2 26 Q60 -12 118 26" : "M2 4 Q60 42 118 4"}
        stroke="currentColor"
        strokeWidth="1.6"
        strokeDasharray="7 6"
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}

export async function Steps() {
  const locale = await getLocale();
  const t = await getTranslations("Steps");
  const steps = getSteps(locale);

  return (
    <section aria-labelledby="steps-h" className="py-14 lg:py-20">
      <Wrap>
        <SectionHead label={t("label")} title={t("title")} body={t("body")} id="steps-h" center />
        <ol className="mt-10 grid list-none gap-9 md:grid-cols-3 md:gap-6">
          {steps.map((s, i) => {
            const StepIcon = ICONS[i] ?? Wrench;
            return (
              <li key={s.n} className="relative flex flex-col items-center text-center">
                <div className="group relative grid size-[124px] place-items-center rounded-full border-[1.5px] md:size-[150px] border-dashed border-[#CFCBC4] bg-surface transition-colors hover:border-accent dark:border-[#3a3733]">
                  <span className="absolute -top-1 -start-6 grid size-8 place-items-center rounded-full bg-sand text-sm font-bold text-ink">
                    {i + 1}
                  </span>
                  <span className="grid size-16 place-items-center rounded-full bg-accent/10 text-accent-ink transition-transform duration-300 group-hover:scale-110">
                    <StepIcon className="size-7" strokeWidth={1.9} aria-hidden="true" />
                  </span>
                </div>
                {i < steps.length - 1 && <Connector up={i % 2 === 1} />}
                <h3 className="mt-6 text-lg font-bold">{s.title}</h3>
                <p className="mt-1.5 max-w-[300px] text-[15px] text-muted">{s.body}</p>
              </li>
            );
          })}
        </ol>
      </Wrap>
    </section>
  );
}
