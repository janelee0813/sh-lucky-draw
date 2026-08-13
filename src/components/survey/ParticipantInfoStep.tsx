"use client";

import { motion } from "framer-motion";
import { PARTICIPANT_FIELDS } from "@/lib/config/survey-questions";

export type ParticipantInfo = {
  name: string;
  company: string;
  phone: string;
  email: string;
};

export function ParticipantInfoStep({
  info,
  onChange,
}: {
  info: ParticipantInfo;
  onChange: (info: ParticipantInfo) => void;
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
        참여자 정보를{"\n"}입력해주세요.
      </h2>
      <div className="flex flex-col gap-4">
        {PARTICIPANT_FIELDS.map((field) => (
          <div key={field.key} className="flex flex-col gap-1.5">
            <label className="text-[13px] font-semibold text-neutral-500">
              {field.label}
              {field.required && <span className="text-sh-blue ml-1">*</span>}
              {!field.required && <span className="text-neutral-400 ml-1">(선택)</span>}
            </label>
            <input
              type={field.type}
              inputMode={field.type === "tel" ? "tel" : undefined}
              placeholder={field.placeholder}
              value={info[field.key]}
              onChange={(e) => onChange({ ...info, [field.key]: e.target.value })}
              className="w-full rounded-xl border border-neutral-200 bg-neutral-50 px-4 py-3.5 text-[15px] text-neutral-900 outline-none focus:border-sh-blue focus:bg-white transition-colors"
            />
          </div>
        ))}
      </div>
    </motion.div>
  );
}
