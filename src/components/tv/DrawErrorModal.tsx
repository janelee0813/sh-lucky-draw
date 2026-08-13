"use client";

import { motion } from "framer-motion";

export function DrawErrorModal({
  title,
  description,
  onClose,
}: {
  title: string;
  description?: string;
  onClose: () => void;
}) {
  return (
    <div className="absolute inset-0 z-30 flex items-center justify-center bg-black/70 backdrop-blur-sm">
      <motion.div
        initial={{ opacity: 0, scale: 0.94 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.25 }}
        className="w-[520px] rounded-[32px] border border-red-400/20 bg-[#0A1230] p-10 text-center"
      >
        <p className="text-[19px] font-bold text-white">{title}</p>
        {description && <p className="mt-3 text-[15px] leading-relaxed text-white/60">{description}</p>}
        <button
          type="button"
          onClick={onClose}
          className="mt-8 w-full rounded-2xl border border-white/15 py-4 text-[16px] font-bold text-white hover:bg-white/5"
        >
          확인
        </button>
      </motion.div>
    </div>
  );
}
