"use client";

import { forwardRef } from "react";

export const TicketCard = forwardRef<HTMLDivElement, { ticketNumber: string }>(function TicketCard(
  { ticketNumber },
  ref
) {
  return (
    <div
      ref={ref}
      className="relative overflow-hidden rounded-[28px] bg-sh-black px-7 py-8 text-white"
      style={{
        backgroundImage:
          "radial-gradient(circle at 100% 0%, rgba(49,231,255,0.18), transparent 55%), radial-gradient(circle at 0% 100%, rgba(0,70,255,0.25), transparent 55%)",
      }}
    >
      <div className="flex items-center justify-between">
        <span className="text-[13px] font-extrabold tracking-widest">SH</span>
        <span className="text-[10px] font-semibold tracking-widest text-white/50">
          EVENT · LUCKY DRAW
        </span>
      </div>

      <div className="mt-8">
        <div className="text-[12px] font-bold tracking-[0.2em] text-sh-cyan">
          LUCKY DRAW TICKET
        </div>
        <div className="mt-3 font-display text-[56px] font-black leading-none tracking-tight">
          {ticketNumber}
        </div>
      </div>

      <div className="my-6 flex items-center gap-2">
        <div className="h-px flex-1 bg-white/10" />
        <span className="text-[10px] tracking-widest text-white/30">SCISSOR LINE</span>
        <div className="h-px flex-1 bg-white/10" />
      </div>

      <div className="flex items-center justify-between">
        <span className="rounded-full border border-sh-cyan/40 bg-sh-cyan/10 px-3 py-1 text-[11px] font-bold text-sh-cyan">
          NO BLANK · 100% WIN
        </span>
        <span className="text-[10px] font-semibold text-white/40">AI EXPO 2026</span>
      </div>

      <p className="mt-6 text-[12px] leading-relaxed text-white/60">
        현장 이벤트 진행자에게
        <br />
        응모번호를 보여주세요.
      </p>
    </div>
  );
});
