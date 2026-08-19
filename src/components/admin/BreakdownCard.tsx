"use client";

import { type SurveyOption } from "@/lib/config/survey-questions";

export function BreakdownCard({
  title,
  options,
  counts,
}: {
  title: string;
  options: SurveyOption[];
  counts: Record<string, number>;
}) {
  const total = Object.values(counts).reduce((a, b) => a + b, 0);
  return (
    <div className="rounded-2xl border border-neutral-200 bg-white p-5">
      <div className="text-[13px] font-bold leading-snug text-neutral-900">{title}</div>
      <div className="mt-4 flex flex-col gap-3">
        {options.map((opt) => {
          const count = counts[opt.value] ?? 0;
          const pct = total > 0 ? Math.round((count / total) * 100) : 0;
          return (
            <div key={opt.value}>
              <div className="flex items-center justify-between gap-3 text-[12.5px]">
                <span className="text-neutral-600">{opt.label}</span>
                <span className="whitespace-nowrap font-bold text-neutral-900">
                  {count}명 <span className="font-normal text-neutral-400">({pct}%)</span>
                </span>
              </div>
              <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-neutral-100">
                <div
                  className="h-full rounded-full bg-sh-blue transition-all duration-500"
                  style={{ width: `${pct}%` }}
                />
              </div>
            </div>
          );
        })}
        {total === 0 && <div className="text-[12px] text-neutral-300">아직 응답이 없습니다.</div>}
      </div>
    </div>
  );
}
