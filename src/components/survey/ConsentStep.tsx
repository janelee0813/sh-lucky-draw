"use client";

import { motion } from "framer-motion";
import { PRIVACY_CONSENT_TEXT } from "@/lib/config/survey-questions";

export function ConsentStep({
  consent,
  onChange,
}: {
  consent: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -16 }}
      transition={{ duration: 0.35, ease: "easeOut" }}
      className="flex flex-col gap-6"
    >
      <h2 className="text-[22px] leading-[1.4] font-bold text-neutral-900">
        마지막으로,{"\n"}약관에 동의해주세요.
      </h2>

      <div className="rounded-2xl border border-neutral-200 bg-neutral-50 p-4">
        <p className="text-[13px] font-semibold text-neutral-700 mb-2">{PRIVACY_CONSENT_TEXT.title}</p>
        <p className="text-[12px] leading-relaxed text-neutral-500 whitespace-pre-line max-h-40 overflow-y-auto">
          {PRIVACY_CONSENT_TEXT.body}
        </p>
      </div>

      <button
        type="button"
        onClick={() => onChange(!consent)}
        className={`w-full flex items-center gap-3 rounded-2xl border px-5 py-4 text-left transition-colors ${
          consent ? "border-sh-blue bg-sh-blue/5" : "border-neutral-200 bg-white"
        }`}
      >
        <span
          className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-md border-2 text-[11px] font-bold text-white transition-colors ${
            consent ? "border-sh-blue bg-sh-blue" : "border-neutral-300 bg-white"
          }`}
        >
          {consent ? "✓" : ""}
        </span>
        <span className="text-[14px] font-medium text-neutral-800">
          {PRIVACY_CONSENT_TEXT.checkboxLabel}
        </span>
      </button>
    </motion.div>
  );
}
