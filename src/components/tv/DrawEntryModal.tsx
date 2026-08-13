"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { NumericKeypad } from "./NumericKeypad";

export function DrawEntryModal({
  onClose,
  onStart,
}: {
  onClose: () => void;
  onStart: (ticketNumber: string) => void;
}) {
  const [value, setValue] = useState("");
  const digits = value.padEnd(4, "•").split("");

  return (
    <div className="absolute inset-0 z-30 flex items-center justify-center bg-black/70 backdrop-blur-sm">
      <motion.div
        initial={{ opacity: 0, scale: 0.94 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.25 }}
        className="w-[640px] rounded-[32px] border border-white/10 bg-[#0A1230] p-10"
      >
        <button
          type="button"
          onClick={onClose}
          className="absolute right-8 top-8 text-[13px] text-white/40 hover:text-white/70"
        >
          닫기
        </button>

        <h2 className="text-center text-[22px] font-bold text-white">
          응모권 번호를 입력해주세요
        </h2>

        <div className="mx-auto mt-8 flex w-fit gap-4">
          {digits.map((d, i) => (
            <div
              key={i}
              className={`flex h-16 w-14 items-center justify-center rounded-xl border text-[26px] font-bold ${
                i < value.length
                  ? "border-sh-cyan bg-sh-cyan/10 text-white"
                  : "border-white/10 text-white/20"
              }`}
            >
              {i < value.length ? d : "·"}
            </div>
          ))}
        </div>

        <div className="mt-10">
          <NumericKeypad value={value} onChange={setValue} />
        </div>

        <button
          type="button"
          disabled={value.length !== 4}
          onClick={() => onStart(value)}
          className="mt-8 w-full rounded-2xl bg-gradient-to-r from-sh-blue to-sh-cyan py-5 text-[18px] font-bold text-white transition-opacity disabled:opacity-30"
        >
          추첨 시작
        </button>
      </motion.div>
    </div>
  );
}
