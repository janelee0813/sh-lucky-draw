"use client";

import { useRouter } from "next/navigation";
import type { PublicPrizeStatus } from "@/types/database";

export function PrizePanel({
  prizes,
  totalRemaining,
  drawClosed,
  onOpenDraw,
}: {
  prizes: PublicPrizeStatus[];
  totalRemaining: number;
  drawClosed: boolean;
  onOpenDraw: () => void;
}) {
  const router = useRouter();

  return (
    <div className="absolute right-0 top-0 flex h-full w-[384px] flex-col justify-between border-l border-white/10 bg-white/[0.03] px-8 py-10 backdrop-blur-sm">
      <div>
        <div className="flex items-start justify-between">
          <div>
            <div className="text-[13px] font-extrabold tracking-widest text-white">LUCKY DRAW</div>
            <div className="text-[13px] font-extrabold tracking-widest text-sh-cyan">PRIZE STATUS</div>
          </div>
          <button
            type="button"
            onClick={() => router.push("/survey")}
            className="rounded-full border border-white/15 px-2.5 py-1 text-[9px] font-medium text-white/40 hover:text-white/70"
          >
            사용자 화면
          </button>
        </div>

        <div className="mt-6 rounded-2xl border border-white/10 bg-white/[0.04] px-5 py-5">
          <div className="text-[13px] font-bold tracking-widest text-white/40">TOTAL PRIZES</div>
          <div className="mt-1 font-display text-[72px] font-black leading-none text-white">
            {totalRemaining}
          </div>
        </div>

        <div className="mt-6 flex flex-col gap-3">
          {prizes.map((p) => (
            <div
              key={p.id}
              className={`flex items-center justify-between rounded-xl border px-4 py-4 transition-opacity ${
                p.remaining_quantity === 0
                  ? "border-white/5 opacity-30"
                  : "border-white/10 bg-white/[0.03]"
              }`}
            >
              <div className="flex items-center gap-3">
                <span className="text-[18px] font-extrabold text-sh-cyan">
                  {String(p.rank).padStart(2, "0")}
                </span>
                <span className="text-[19px] font-bold text-white">{p.name}</span>
              </div>
              <span className="text-[19px] font-extrabold text-white">
                {p.remaining_quantity} LEFT
              </span>
            </div>
          ))}
        </div>
      </div>

      <button
        type="button"
        onClick={onOpenDraw}
        disabled={drawClosed}
        className="w-full rounded-2xl bg-gradient-to-r from-sh-blue to-sh-cyan py-6 text-center shadow-[0_0_40px_rgba(49,231,255,0.35)] transition-transform active:scale-[0.98] disabled:opacity-30 disabled:shadow-none"
      >
        <div className="text-[13px] font-bold tracking-widest text-white/80">LUCKY DRAW</div>
        <div className="mt-1 text-[20px] font-extrabold text-white">
          {drawClosed ? "이벤트가 종료되었습니다" : "이벤트 응모하기"}
        </div>
      </button>
    </div>
  );
}
