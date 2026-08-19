"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { SURVEY_QUESTIONS, SURVEY_UI_TEXT, type Lang } from "@/lib/config/survey-questions";
import { ProgressBar } from "./ProgressBar";
import { StepQuestion } from "./StepQuestion";
import { ParticipantInfoStep, isCompanionValid, type CompanionInfo, type ParticipantInfo } from "./ParticipantInfoStep";
import { ConsentStep } from "./ConsentStep";

type Phase = "loading" | "closed" | "intro" | "questions" | "info" | "consent" | "submitting" | "error";

const EMPTY_INFO: ParticipantInfo = {
  name: "",
  phone: "",
  email: "",
  company: "",
  jobRole: "",
  rndDept: "",
  rndDeptName: "",
  rndRelocationPlan: "",
  hqLocation: "",
  hqLocationOther: "",
};

export function SurveyFlow() {
  const router = useRouter();
  const [phase, setPhase] = useState<Phase>("loading");
  const [questionIndex, setQuestionIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [info, setInfo] = useState<ParticipantInfo>(EMPTY_INFO);
  const [companions, setCompanions] = useState<CompanionInfo[]>([]);
  const [consent, setConsent] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [existingTicket, setExistingTicket] = useState<string | null>(null);
  const [lang, setLang] = useState<Lang>("ko");
  const t = SURVEY_UI_TEXT;

  const totalSteps = SURVEY_QUESTIONS.length + 2; // 질문들 + 정보입력 + 동의

  useEffect(() => {
    let cancelled = false;
    fetch("/api/prizes")
      .then((res) => res.json())
      .then((data) => {
        if (cancelled) return;
        setPhase(data.surveyClosed ? "closed" : "intro");
      })
      .catch(() => {
        if (!cancelled) setPhase("intro");
      });
    return () => {
      cancelled = true;
    };
  }, []);

  function currentStepNumber() {
    if (phase === "questions") return questionIndex + 1;
    if (phase === "info") return SURVEY_QUESTIONS.length + 1;
    if (phase === "consent") return SURVEY_QUESTIONS.length + 2;
    return 0;
  }

  function handleSelectAnswer(value: string) {
    const q = SURVEY_QUESTIONS[questionIndex];
    setAnswers((prev) => ({ ...prev, [q.key]: value }));
    setTimeout(() => {
      if (questionIndex < SURVEY_QUESTIONS.length - 1) {
        setQuestionIndex((i) => i + 1);
      } else {
        setPhase("info");
      }
    }, 220);
  }

  function handleBack() {
    if (phase === "questions") {
      if (questionIndex > 0) {
        setQuestionIndex((i) => i - 1);
      } else {
        setPhase("intro");
      }
    } else if (phase === "info") {
      setQuestionIndex(SURVEY_QUESTIONS.length - 1);
      setPhase("questions");
    } else if (phase === "consent" || phase === "error") {
      setErrorMessage(null);
      setExistingTicket(null);
      setPhase("info");
    }
  }

  function isInfoValid() {
    const basicsValid =
      info.name.trim().length > 0 &&
      info.phone.trim().length > 0 &&
      info.email.trim().length > 0 &&
      info.company.trim().length > 0 &&
      info.jobRole.length > 0 &&
      info.rndDept.length > 0 &&
      info.hqLocation.length > 0;

    const rndValid =
      info.rndDept !== "has" ||
      (info.rndDeptName.trim().length > 0 && info.rndRelocationPlan.length > 0);

    const hqValid = info.hqLocation !== "etc" || info.hqLocationOther.trim().length > 0;

    const companionsValid = companions.every(isCompanionValid);

    return basicsValid && rndValid && hqValid && companionsValid;
  }

  async function handleSubmit() {
    setPhase("submitting");
    setErrorMessage(null);
    setExistingTicket(null);
    try {
      const res = await fetch("/api/survey", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: info.name.trim(),
          phone: info.phone.trim(),
          email: info.email.trim(),
          company: info.company.trim(),
          job_role: info.jobRole,
          rnd_dept: info.rndDept,
          rnd_dept_name: info.rndDept === "has" ? info.rndDeptName.trim() : null,
          rnd_relocation_plan: info.rndDept === "has" ? info.rndRelocationPlan : null,
          hq_location: info.hqLocation,
          hq_location_other: info.hqLocation === "etc" ? info.hqLocationOther.trim() : null,
          survey_answer_1: answers.survey_answer_1,
          survey_answer_2: answers.survey_answer_2,
          privacy_consent: true,
          companions: companions.map((c) => ({
            name: c.name.trim(),
            team: c.team.trim(),
            position: c.position.trim(),
            phone: c.phone.trim(),
          })),
        }),
      });
      const data = await res.json();

      if (!res.ok) {
        if (data.error === "DUPLICATE_PHONE") {
          setExistingTicket(
            data.existingTicketNumber ? String(data.existingTicketNumber).padStart(4, "0") : null
          );
        }
        setErrorMessage(errorMessageForCode(data.error, lang) || data.message || t.errorGeneric[lang]);
        setPhase("error");
        return;
      }

      const ticketNumber = String(data.ticketNumber).padStart(4, "0");
      router.push(`/ticket/${ticketNumber}`);
    } catch {
      setErrorMessage(t.errorNetwork[lang]);
      setPhase("error");
    }
  }

  function errorMessageForCode(code: string | undefined, lang: Lang): string | null {
    switch (code) {
      case "EVENT_FULL":
        return t.errorEventFull[lang];
      case "DUPLICATE_PHONE":
        return t.errorDuplicatePhone[lang];
      case "INVALID_PHONE":
        return t.errorInvalidPhone[lang];
      case "INVALID_EMAIL":
        return t.errorInvalidEmail[lang];
      default:
        return null;
    }
  }

  if (phase === "loading") {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-neutral-300 border-t-sh-blue" />
      </div>
    );
  }

  function LanguageToggle() {
    return (
      <button
        type="button"
        onClick={() => setLang((l) => (l === "ko" ? "en" : "ko"))}
        className="shrink-0 rounded-full border border-neutral-200 px-3 py-1.5 text-[11px] font-bold tracking-widest text-neutral-500 transition-transform active:scale-95"
      >
        {t.langToggle[lang]}
      </button>
    );
  }

  if (phase === "closed") {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-4 px-8 text-center">
        <span className="text-[13px] font-bold tracking-widest text-sh-blue">SH · LUCKY DRAW</span>
        <h1 className="text-2xl font-extrabold text-neutral-900">{t.closedTitle[lang]}</h1>
        <p className="text-[14px] leading-relaxed text-neutral-500 whitespace-pre-line">
          {t.closedBody[lang]}
        </p>
      </div>
    );
  }

  if (phase === "intro") {
    return (
      <div className="flex h-full flex-col justify-between px-6 pb-8 pt-10">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="text-[13px] font-extrabold tracking-widest text-sh-blue">
              SH 서울주택도시개발공사
            </div>
            <div className="mt-1 text-[11px] font-semibold tracking-widest text-neutral-400">
              EVENT · LUCKY DRAW
            </div>
          </div>
          <LanguageToggle />
        </div>

        <div className="flex flex-col gap-4">
          <h1 className="text-[28px] leading-[1.3] font-extrabold text-neutral-900 whitespace-pre-line">
            {t.introHeading[lang]}
          </h1>
          <p className="text-[14px] leading-relaxed text-neutral-500 whitespace-pre-line">
            {t.introDesc[lang]}
          </p>
          <div className="mt-2 inline-flex w-fit items-center gap-2 rounded-full bg-sh-blue/10 px-3 py-1.5 text-[12px] font-bold text-sh-blue">
            NO BLANK · 100% WIN
          </div>
        </div>

        <button
          type="button"
          onClick={() => setPhase("questions")}
          className="w-full rounded-2xl bg-sh-blue py-4 text-center text-[16px] font-bold text-white shadow-lg shadow-sh-blue/20 active:scale-[0.98] transition-transform"
        >
          {t.introButton[lang]}
        </button>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col px-6 pb-8 pt-8">
      <div className="mb-8 flex items-center gap-3">
        {phase !== "submitting" && (
          <button
            type="button"
            onClick={handleBack}
            aria-label={t.backAriaLabel[lang]}
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-neutral-200 text-neutral-500 transition-transform active:scale-95"
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M15 18l-6-6 6-6" />
            </svg>
          </button>
        )}
        <div className="flex-1">
          <ProgressBar step={currentStepNumber()} total={totalSteps} />
        </div>
        {phase !== "submitting" && <LanguageToggle />}
      </div>

      <div className="flex-1 overflow-y-auto no-scrollbar">
        <AnimatePresence mode="wait">
          {phase === "questions" && (
            <StepQuestion
              key={`q-${questionIndex}`}
              question={SURVEY_QUESTIONS[questionIndex]}
              value={answers[SURVEY_QUESTIONS[questionIndex].key] ?? null}
              onSelect={handleSelectAnswer}
              lang={lang}
            />
          )}
          {phase === "info" && (
            <ParticipantInfoStep
              key="info"
              info={info}
              onChange={setInfo}
              companions={companions}
              onCompanionsChange={setCompanions}
              lang={lang}
            />
          )}
          {(phase === "consent" || phase === "submitting" || phase === "error") && (
            <div key="consent-wrap" className="flex flex-col gap-6">
              <ConsentStep consent={consent} onChange={setConsent} lang={lang} />
              {errorMessage && (
                <div className="rounded-xl bg-red-50 px-4 py-3 text-[13px] text-red-600">
                  {errorMessage}
                  {existingTicket && (
                    <button
                      type="button"
                      onClick={() => router.push(`/ticket/${existingTicket}`)}
                      className="mt-2 block font-bold underline"
                    >
                      {t.existingTicketButton[lang]} ({existingTicket})
                    </button>
                  )}
                </div>
              )}
            </div>
          )}
        </AnimatePresence>
      </div>

      <div className="mt-6 flex flex-col gap-3">
        {phase === "info" && (
          <button
            type="button"
            disabled={!isInfoValid()}
            onClick={() => setPhase("consent")}
            className="w-full rounded-2xl bg-sh-blue py-4 text-center text-[16px] font-bold text-white disabled:opacity-30 transition-opacity active:scale-[0.98]"
          >
            {t.nextButton[lang]}
          </button>
        )}
        {(phase === "consent" || phase === "error") && (
          <button
            type="button"
            disabled={!consent}
            onClick={handleSubmit}
            className="w-full rounded-2xl bg-sh-blue py-4 text-center text-[16px] font-bold text-white disabled:opacity-30 transition-opacity active:scale-[0.98]"
          >
            {t.submitButton[lang]}
          </button>
        )}
        {phase === "submitting" && (
          <button
            disabled
            className="w-full rounded-2xl bg-sh-blue/60 py-4 text-center text-[16px] font-bold text-white"
          >
            {t.submittingButton[lang]}
          </button>
        )}
      </div>
    </div>
  );
}
