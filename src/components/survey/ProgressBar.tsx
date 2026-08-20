"use client";

export function ProgressBar({ step, total }: { step: number; total: number }) {
  const pct = Math.min(100, Math.round((step / total) * 100));
  return (
    <div className="w-full">
      <div className="flex items-center justify-between mb-2">
        <span className="text-[11px] font-semibold tracking-widest text-neutral-400">
          STEP {String(step).padStart(2, "0")} / {String(total).padStart(2, "0")}
        </span>
      </div>
      <div className="h-1 w-full rounded-full bg-neutral-200 overflow-hidden">
        <div
          className="h-full w-full origin-left rounded-full bg-sh-blue transition-transform duration-500 ease-out"
          style={{ transform: `scaleX(${pct / 100})` }}
        />
      </div>
    </div>
  );
}
