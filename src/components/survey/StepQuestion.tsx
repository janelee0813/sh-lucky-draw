"use client";

import { motion } from "framer-motion";
import { optionLabelForLang, type Lang, type SurveyQuestion } from "@/lib/config/survey-questions";

export function StepQuestion({
  question,
  value,
  onSelect,
  lang,
}: {
  question: SurveyQuestion;
  value: string | null;
  onSelect: (value: string) => void;
  lang: Lang;
}) {
  const notice = lang === "en" ? question.noticeEn : question.notice;
  const title = lang === "en" ? question.titleEn : question.title;
  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -16 }}
      transition={{ duration: 0.35, ease: "easeOut" }}
      className="flex flex-col gap-6"
    >
      <div className="flex flex-col gap-4">
        {notice && (
          <p className="rounded-xl border border-sh-blue/25 border-l-4 border-l-sh-blue bg-sh-blue/5 px-4 py-3.5 text-[15px] font-semibold leading-relaxed text-neutral-700">
            {notice}
          </p>
        )}
        <h2 className="text-[22px] leading-[1.4] font-bold text-neutral-900 whitespace-pre-line">
          {title}
        </h2>
      </div>
      <div className="flex flex-col gap-3">
        {question.options.map((opt, i) => {
          const selected = value === opt.value;
          return (
            <motion.button
              key={opt.value}
              type="button"
              onClick={() => onSelect(opt.value)}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: 0.05 * i }}
              className={`w-full text-left rounded-2xl border px-5 py-4 text-[15px] font-medium transition-all active:scale-[0.98] ${
                selected
                  ? "border-sh-blue bg-sh-blue text-white shadow-lg shadow-sh-blue/20"
                  : "border-neutral-200 bg-white text-neutral-700 hover:border-neutral-300"
              }`}
            >
              {optionLabelForLang(opt, lang)}
            </motion.button>
          );
        })}
      </div>
    </motion.div>
  );
}
