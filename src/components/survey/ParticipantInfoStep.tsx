"use client";

import { AnimatePresence, motion } from "framer-motion";
import {
  HQ_LOCATION_OPTIONS,
  HQ_LOCATION_OTHER_VALUE,
  JOB_ROLE_OPTIONS,
  PARTICIPANT_FIELDS,
  RND_DEPT_OPTIONS,
  RND_RELOCATION_OPTIONS,
  type SurveyOption,
} from "@/lib/config/survey-questions";

export type ParticipantInfo = {
  name: string;
  phone: string;
  email: string;
  company: string;
  jobRole: string;
  rndDept: string;
  rndDeptName: string;
  rndRelocationPlan: string;
  hqLocation: string;
  hqLocationOther: string;
};

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <h3 className="text-[16px] leading-[1.4] font-bold text-neutral-900">{children}</h3>;
}

function TextField({
  label,
  placeholder,
  type,
  value,
  onChange,
  required,
}: {
  label: string;
  placeholder: string;
  type: string;
  value: string;
  onChange: (v: string) => void;
  required?: boolean;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-[13px] font-semibold text-neutral-500">
        {label}
        {required && <span className="text-sh-blue ml-1">*</span>}
      </label>
      <input
        type={type}
        inputMode={type === "tel" ? "tel" : undefined}
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-xl border border-neutral-200 bg-neutral-50 px-4 py-3.5 text-[15px] text-neutral-900 outline-none focus:border-sh-blue focus:bg-white transition-colors"
      />
    </div>
  );
}

function OptionGroup({
  options,
  value,
  onChange,
}: {
  options: SurveyOption[];
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="grid grid-cols-2 gap-2">
      {options.map((opt) => {
        const selected = value === opt.value;
        return (
          <button
            key={opt.value}
            type="button"
            onClick={() => onChange(opt.value)}
            className={`rounded-xl border px-3.5 py-3 text-left text-[13.5px] font-medium leading-snug transition-all active:scale-[0.98] ${
              selected
                ? "border-sh-blue bg-sh-blue text-white shadow-md shadow-sh-blue/20"
                : "border-neutral-200 bg-white text-neutral-700 hover:border-neutral-300"
            }`}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}

export function ParticipantInfoStep({
  info,
  onChange,
}: {
  info: ParticipantInfo;
  onChange: (info: ParticipantInfo) => void;
}) {
  function set<K extends keyof ParticipantInfo>(key: K, value: ParticipantInfo[K]) {
    onChange({ ...info, [key]: value });
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -16 }}
      transition={{ duration: 0.35, ease: "easeOut" }}
      className="flex flex-col gap-8"
    >
      <h2 className="text-[22px] leading-[1.4] font-bold text-neutral-900">
        참여자 정보를{"\n"}입력해주세요.
      </h2>

      {/* 1. 성함 / 연락처 / 이메일 */}
      <div className="flex flex-col gap-4">
        <SectionTitle>귀하의 성함과 연락처를 입력해 주세요.</SectionTitle>
        {PARTICIPANT_FIELDS.map((field) => (
          <TextField
            key={field.key}
            label={field.label}
            placeholder={field.placeholder}
            type={field.type}
            required={field.required}
            value={info[field.key]}
            onChange={(v) => set(field.key, v)}
          />
        ))}
      </div>

      {/* 2. 기업명 + 직무 분야 */}
      <div className="flex flex-col gap-4">
        <SectionTitle>현재 소속되신 기업명과 본인의 업무(직무) 분야는 무엇인가요?</SectionTitle>
        <TextField
          label="기업명"
          placeholder="OO 주식회사"
          type="text"
          required
          value={info.company}
          onChange={(v) => set("company", v)}
        />
        <div className="flex flex-col gap-1.5">
          <label className="text-[13px] font-semibold text-neutral-500">
            직무 <span className="text-sh-blue ml-1">*</span>
          </label>
          <OptionGroup options={JOB_ROLE_OPTIONS} value={info.jobRole} onChange={(v) => set("jobRole", v)} />
        </div>
      </div>

      {/* 3. R&D 전담 부서 보유 여부 */}
      <div className="flex flex-col gap-4">
        <SectionTitle>
          귀사(소속 기업)에 기업부설연구소 또는{"\n"}연구개발(R&D) 전담 부서가 있습니까?
        </SectionTitle>
        <OptionGroup options={RND_DEPT_OPTIONS} value={info.rndDept} onChange={(v) => set("rndDept", v)} />

        <AnimatePresence initial={false}>
          {info.rndDept === "has" && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.25, ease: "easeOut" }}
              className="flex flex-col gap-4 overflow-hidden rounded-2xl border border-neutral-100 bg-neutral-50 p-4"
            >
              <TextField
                label="부서명 / 연구소명"
                placeholder="예: OO기술연구소"
                type="text"
                required
                value={info.rndDeptName}
                onChange={(v) => set("rndDeptName", v)}
              />
              <div className="flex flex-col gap-1.5">
                <label className="text-[13px] font-semibold text-neutral-500">
                  해당 연구소(부서)의 이전 또는 확장 계획이 있습니까?
                  <span className="text-sh-blue ml-1">*</span>
                </label>
                <OptionGroup
                  options={RND_RELOCATION_OPTIONS}
                  value={info.rndRelocationPlan}
                  onChange={(v) => set("rndRelocationPlan", v)}
                />
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* 4. 본사/연구실 위치 */}
      <div className="flex flex-col gap-4">
        <SectionTitle>귀사(소속 기업)의 본사/연구실 위치는 어디십니까?</SectionTitle>
        <OptionGroup
          options={HQ_LOCATION_OPTIONS}
          value={info.hqLocation}
          onChange={(v) => set("hqLocation", v)}
        />

        <AnimatePresence initial={false}>
          {info.hqLocation === HQ_LOCATION_OTHER_VALUE && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.25, ease: "easeOut" }}
              className="overflow-hidden"
            >
              <TextField
                label="지역 직접 입력"
                placeholder="예: 인천"
                type="text"
                required
                value={info.hqLocationOther}
                onChange={(v) => set("hqLocationOther", v)}
              />
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}
