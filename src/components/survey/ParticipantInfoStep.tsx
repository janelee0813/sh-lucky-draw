"use client";

import { AnimatePresence, motion } from "framer-motion";
import {
  HQ_LOCATION_OPTIONS,
  HQ_LOCATION_OTHER_VALUE,
  JOB_ROLE_OPTIONS,
  PARTICIPANT_FIELDS,
  RND_DEPT_OPTIONS,
  RND_RELOCATION_OPTIONS,
  SURVEY_UI_TEXT,
  optionLabelForLang,
  type Lang,
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

export type CompanionInfo = {
  name: string;
  team: string;
  position: string;
  phone: string;
};

export const EMPTY_COMPANION: CompanionInfo = { name: "", team: "", position: "", phone: "" };
export const MAX_COMPANIONS = 5;

export function isCompanionValid(c: CompanionInfo): boolean {
  return (
    c.name.trim().length > 0 &&
    c.team.trim().length > 0 &&
    c.position.trim().length > 0 &&
    c.phone.trim().length > 0
  );
}

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
  lang,
}: {
  options: SurveyOption[];
  value: string;
  onChange: (v: string) => void;
  lang: Lang;
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
            {optionLabelForLang(opt, lang)}
          </button>
        );
      })}
    </div>
  );
}

export function ParticipantInfoStep({
  info,
  onChange,
  companions,
  onCompanionsChange,
  lang,
}: {
  info: ParticipantInfo;
  onChange: (info: ParticipantInfo) => void;
  companions: CompanionInfo[];
  onCompanionsChange: (companions: CompanionInfo[]) => void;
  lang: Lang;
}) {
  function set<K extends keyof ParticipantInfo>(key: K, value: ParticipantInfo[K]) {
    onChange({ ...info, [key]: value });
  }
  function setCompanion<K extends keyof CompanionInfo>(index: number, key: K, value: CompanionInfo[K]) {
    onCompanionsChange(companions.map((c, i) => (i === index ? { ...c, [key]: value } : c)));
  }
  function addCompanion() {
    if (companions.length >= MAX_COMPANIONS) return;
    onCompanionsChange([...companions, { ...EMPTY_COMPANION }]);
  }
  function removeCompanion(index: number) {
    onCompanionsChange(companions.filter((_, i) => i !== index));
  }
  const t = SURVEY_UI_TEXT;

  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -16 }}
      transition={{ duration: 0.35, ease: "easeOut" }}
      className="flex flex-col gap-8"
    >
      <h2 className="text-[22px] leading-[1.4] font-bold text-neutral-900 whitespace-pre-line">
        {t.infoHeading[lang]}
      </h2>

      {/* 1. 성함 / 연락처 / 이메일 */}
      <div className="flex flex-col gap-4">
        <SectionTitle>{t.infoSection1[lang]}</SectionTitle>
        {PARTICIPANT_FIELDS.map((field) => (
          <TextField
            key={field.key}
            label={lang === "en" ? field.labelEn : field.label}
            placeholder={lang === "en" ? field.placeholderEn : field.placeholder}
            type={field.type}
            required={field.required}
            value={info[field.key]}
            onChange={(v) => set(field.key, v)}
          />
        ))}
      </div>

      {/* 2. 기업명 + 직무 분야 */}
      <div className="flex flex-col gap-4">
        <SectionTitle>{t.infoSection2[lang]}</SectionTitle>
        <TextField
          label={t.companyLabel[lang]}
          placeholder={t.companyPlaceholder[lang]}
          type="text"
          required
          value={info.company}
          onChange={(v) => set("company", v)}
        />
        <div className="flex flex-col gap-1.5">
          <label className="text-[13px] font-semibold text-neutral-500">
            {t.jobRoleLabel[lang]} <span className="text-sh-blue ml-1">*</span>
          </label>
          <OptionGroup
            options={JOB_ROLE_OPTIONS}
            value={info.jobRole}
            onChange={(v) => set("jobRole", v)}
            lang={lang}
          />
        </div>
      </div>

      {/* 3. R&D 전담 부서 보유 여부 */}
      <div className="flex flex-col gap-4">
        <SectionTitle>
          <span className="whitespace-pre-line">{t.infoSection3[lang]}</span>
        </SectionTitle>
        <OptionGroup
          options={RND_DEPT_OPTIONS}
          value={info.rndDept}
          onChange={(v) => set("rndDept", v)}
          lang={lang}
        />

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
                label={t.rndDeptNameLabel[lang]}
                placeholder={t.rndDeptNamePlaceholder[lang]}
                type="text"
                required
                value={info.rndDeptName}
                onChange={(v) => set("rndDeptName", v)}
              />
              <div className="flex flex-col gap-1.5">
                <label className="text-[13px] font-semibold text-neutral-500">
                  {t.rndRelocationLabel[lang]}
                  <span className="text-sh-blue ml-1">*</span>
                </label>
                <OptionGroup
                  options={RND_RELOCATION_OPTIONS}
                  value={info.rndRelocationPlan}
                  onChange={(v) => set("rndRelocationPlan", v)}
                  lang={lang}
                />
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* 4. 본사/연구실 위치 */}
      <div className="flex flex-col gap-4">
        <SectionTitle>{t.infoSection4[lang]}</SectionTitle>
        <OptionGroup
          options={HQ_LOCATION_OPTIONS}
          value={info.hqLocation}
          onChange={(v) => set("hqLocation", v)}
          lang={lang}
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
                label={t.hqLocationOtherLabel[lang]}
                placeholder={t.hqLocationOtherPlaceholder[lang]}
                type="text"
                required
                value={info.hqLocationOther}
                onChange={(v) => set("hqLocationOther", v)}
              />
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* 5. 동반자 정보 */}
      <div className="flex flex-col gap-4">
        <SectionTitle>{t.infoSection5[lang]}</SectionTitle>
        <AnimatePresence initial={false}>
          {companions.map((c, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.25, ease: "easeOut" }}
              className="flex flex-col gap-3 overflow-hidden rounded-2xl border border-neutral-100 bg-neutral-50 p-4"
            >
              <div className="flex items-center justify-between">
                <span className="text-[13px] font-bold text-neutral-700">
                  {t.companionTitle[lang]} {i + 1}
                </span>
                <button
                  type="button"
                  onClick={() => removeCompanion(i)}
                  className="text-[12px] font-semibold text-neutral-400 underline"
                >
                  {t.companionRemoveButton[lang]}
                </button>
              </div>
              <TextField
                label={t.companionNameLabel[lang]}
                placeholder={t.companionNamePlaceholder[lang]}
                type="text"
                required
                value={c.name}
                onChange={(v) => setCompanion(i, "name", v)}
              />
              <TextField
                label={t.companionTeamLabel[lang]}
                placeholder={t.companionTeamPlaceholder[lang]}
                type="text"
                required
                value={c.team}
                onChange={(v) => setCompanion(i, "team", v)}
              />
              <TextField
                label={t.companionPositionLabel[lang]}
                placeholder={t.companionPositionPlaceholder[lang]}
                type="text"
                required
                value={c.position}
                onChange={(v) => setCompanion(i, "position", v)}
              />
              <TextField
                label={t.companionPhoneLabel[lang]}
                placeholder={t.companionPhonePlaceholder[lang]}
                type="tel"
                required
                value={c.phone}
                onChange={(v) => setCompanion(i, "phone", v)}
              />
            </motion.div>
          ))}
        </AnimatePresence>
        {companions.length < MAX_COMPANIONS && (
          <button
            type="button"
            onClick={addCompanion}
            className="w-full rounded-xl border border-dashed border-neutral-300 py-3 text-[13.5px] font-semibold text-neutral-500 active:scale-[0.98] transition-transform"
          >
            {t.companionAddButton[lang]}
          </button>
        )}
      </div>
    </motion.div>
  );
}
