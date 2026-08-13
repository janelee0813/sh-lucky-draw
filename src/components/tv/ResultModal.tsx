"use client";

import { useMemo } from "react";
import { motion } from "framer-motion";

const CONFETTI_COLORS = ["#31E7FF", "#0046FF", "#FFFFFF", "#7B8CFF"];

export function ResultModal({
  prizeRank,
  prizeName,
  onConfirm,
}: {
  prizeRank: number;
  prizeName: string;
  onConfirm: () => void;
}) {
  const confetti = useMemo(
    () =>
      Array.from({ length: 40 }).map((_, i) => ({
        id: i,
        left: Math.random() * 100,
        delay: Math.random() * 0.6,
        duration: 1.6 + Math.random() * 1.2,
        color: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
        size: 6 + Math.random() * 6,
      })),
    []
  );

  return (
    <div className="absolute inset-0 z-30 flex items-center justify-center bg-black/80 backdrop-blur-md">
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        {confetti.map((c) => (
          <motion.span
            key={c.id}
            initial={{ y: -40, opacity: 0 }}
            animate={{ y: 1100, opacity: [0, 1, 1, 0] }}
            transition={{ duration: c.duration, delay: c.delay, ease: "easeIn" }}
            style={{
              position: "absolute",
              left: `${c.left}%`,
              width: c.size,
              height: c.size,
              backgroundColor: c.color,
              borderRadius: 2,
            }}
          />
        ))}
      </div>

      <motion.div
        initial={{ opacity: 0, scale: 0.85 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.4, ease: "easeOut" }}
        className="relative w-[680px] rounded-[36px] border border-sh-cyan/20 bg-[#070B1E] px-12 py-14 text-center"
        style={{ boxShadow: "0 0 120px rgba(49,231,255,0.15)" }}
      >
        <div className="text-[14px] font-bold tracking-[0.3em] text-sh-cyan">CONGRATULATIONS</div>

        <div className="mt-6 font-display text-[56px] font-black leading-none text-white">
          {prizeRank}등
        </div>

        <div className="mt-4 text-[28px] font-extrabold leading-tight text-white">{prizeName}</div>

        <p className="mt-6 text-[15px] text-white/50">당첨을 축하드립니다.</p>

        <button
          type="button"
          onClick={onConfirm}
          className="mt-10 w-full rounded-2xl bg-gradient-to-r from-sh-blue to-sh-cyan py-5 text-[17px] font-bold text-white"
        >
          확인
        </button>
      </motion.div>
    </div>
  );
}
