"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { SURVEY_QUESTIONS } from "@/lib/config/survey-questions";
import { ProgressBar } from "./ProgressBar";
import { StepQuestion } from "./StepQuestion";
import { ParticipantInfoStep, type ParticipantInfo } from "./ParticipantInfoStep";
import { ConsentStep } from "./ConsentStep";

type Phase = "loading" | "closed" | "intro" | "questions" | "info" | "consent" | "submitting" | "error";

const EMPTY_INFO: ParticipantInfo = { name: "", company: "", phone: "", email: "" };

export function SurveyFlow() {
  const router = useRouter();
  const [phase, setPhase] = useState<Phase>("loading");
  const [questionIndex, setQuestionIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [info, setInfo] = useState<ParticipantInfo>(EMPTY_INFO);
  const [consent, setConsent] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [existingTicket, setExistingTicket] = useState<string | null>(null);

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

  function isInfoValid() {
    return info.name.trim().length > 0 && info.phone.trim().length > 0 && info.email.trim().length > 0;
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
          company: info.company.trim() || null,
          phone: info.phone.trim(),
          email: info.email.trim(),
          survey_answer_1: answers.survey_answer_1,
          survey_answer_2: answers.survey_answer_2,
          privacy_consent: true,
        }),
      });
      const data = await res.json();

      if (!res.ok) {
        if (data.error === "DUPLICATE_PHONE") {
          setExistingTicket(
            data.existingTicketNumber ? String(data.existingTicketNumber).padStart(4, "0") : null
          );
        }
        setErrorMessage(data.message || "오류가 발생했습니다. 다시 시도해주세요.");
        setPhase("error");
        return;
      }

      const ticketNumber = String(data.ticketNumber).padStart(4, "0");
      router.push(`/ticket/${ticketNumber}`);
    } catch {
      setErrorMessage("네트워크 오류가 발생했습니다. 다시 시도해주세요.");
      setPhase("error");
    }
  }

  if (phase === "loading") {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-neutral-300 border-t-sh-blue" />
      </div>
    );
  }

  if (phase === "closed") {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-4 px-8 text-center">
        <span className="text-[13px] font-bold tracking-widest text-sh-blue">SH · LUCKY DRAW</span>
        <h1 className="text-2xl font-extrabold text-neutral-900">참여가 마감되었습니다</h1>
        <p className="text-[14px] leading-relaxed text-neutral-500">
          준비된 모든 응모권이 소진되어
          <br />
          더 이상 설문 참여를 받고 있지 않습니다.
          <br />
          방문해주셔서 감사합니다.
        </p>
      </div>
    );
  }

  if (phase === "intro") {
    return (
      <div className="flex h-full flex-col justify-between px-6 pb-8 pt-10">
        <div>
          <div className="text-[13px] font-extrabold tracking-widest text-sh-blue">SH</div>
          <div className="mt-1 text-[11px] font-semibold tracking-widest text-neutral-400">
            EVENT · LUCKY DRAW
          </div>
        </div>

        <div className="flex flex-col gap-4">
          <h1 className="text-[28px] leading-[1.3] font-extrabold text-neutral-900">
            설문에 참여하고
            <br />
            LUCKY DRAW에 도전하세요.
          </h1>
          <p className="text-[14px] leading-relaxed text-neutral-500">
            간단한 설문을 완료하시면
            <br />
            꽝 없는 이벤트 응모권을 드립니다.
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
          설문 참여하기
        </button>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col px-6 pb-8 pt-8">
      <div className="mb-8">
        <ProgressBar step={currentStepNumber()} total={totalSteps} />
      </div>

      <div className="flex-1 overflow-y-auto no-scrollbar">
        <AnimatePresence mode="wait">
          {phase === "questions" && (
            <StepQuestion
              key={`q-${questionIndex}`}
              question={SURVEY_QUESTIONS[questionIndex]}
              value={answers[SURVEY_QUESTIONS[questionIndex].key] ?? null}
              onSelect={handleSelectAnswer}
            />
          )}
          {phase === "info" && (
            <ParticipantInfoStep key="info" info={info} onChange={setInfo} />
          )}
          {(phase === "consent" || phase === "submitting" || phase === "error") && (
            <div key="consent-wrap" className="flex flex-col gap-6">
              <ConsentStep consent={consent} onChange={setConsent} />
              {errorMessage && (
                <div className="rounded-xl bg-red-50 px-4 py-3 text-[13px] text-red-600">
                  {errorMessage}
                  {existingTicket && (
                    <button
                      type="button"
                      onClick={() => router.push(`/ticket/${existingTicket}`)}
                      className="mt-2 block font-bold underline"
                    >
                      기존 응모권({existingTicket}) 확인하기
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
            다음
          </button>
        )}
        {(phase === "consent" || phase === "error") && (
          <button
            type="button"
            disabled={!consent}
            onClick={handleSubmit}
            className="w-full rounded-2xl bg-sh-blue py-4 text-center text-[16px] font-bold text-white disabled:opacity-30 transition-opacity active:scale-[0.98]"
          >
            응모권 발급받기
          </button>
        )}
        {phase === "submitting" && (
          <button
            disabled
            className="w-full rounded-2xl bg-sh-blue/60 py-4 text-center text-[16px] font-bold text-white"
          >
            응모권을 발급하고 있습니다...
          </button>
        )}
      </div>
    </div>
  );
}
