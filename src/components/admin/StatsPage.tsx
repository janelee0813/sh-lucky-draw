"use client";

import { useEffect, useState } from "react";
import {
  HQ_LOCATION_OPTIONS,
  JOB_ROLE_OPTIONS,
  RND_DEPT_OPTIONS,
  SURVEY_QUESTIONS,
  type SurveyOption,
} from "@/lib/config/survey-questions";
import { useImageDownload } from "@/lib/utils/use-image-download";

type CountMap = Record<string, number>;

type DetailedStats = {
  rounds: number[];
  byRound: {
    survey_answer_1: Record<number, CountMap>;
    survey_answer_2: Record<number, CountMap>;
    job_role: Record<number, CountMap>;
    rnd_dept: Record<number, CountMap>;
    hq_location: Record<number, CountMap>;
  };
  crossTabs: {
    q1ByHqLocation: Record<string, CountMap>;
    q1ByRndDept: Record<string, CountMap>;
    q2ByJobRole: Record<string, CountMap>;
  };
};

// 라운드 구분 없이 전체 합계 기준으로 응답 분포를 보여준다.
function BreakdownTable({
  title,
  options,
  data,
}: {
  title: string;
  options: SurveyOption[];
  data: Record<number, CountMap> | undefined;
}) {
  if (!data) return null;
  const combined: CountMap = {};
  for (const roundCounts of Object.values(data)) {
    for (const [value, count] of Object.entries(roundCounts)) {
      combined[value] = (combined[value] ?? 0) + count;
    }
  }
  const total = Object.values(combined).reduce((a, b) => a + b, 0);

  return (
    <div className="rounded-2xl border border-neutral-200 bg-white p-5">
      <div className="text-[13px] font-bold leading-snug text-neutral-900">{title}</div>
      <div className="mt-3 overflow-x-auto">
        <table className="w-full text-left text-[12.5px]">
          <thead>
            <tr className="border-b border-neutral-100 text-neutral-400">
              <th className="whitespace-nowrap py-1.5 pr-3 font-semibold">항목</th>
              <th className="whitespace-nowrap py-1.5 pr-3 text-right font-semibold">응답수</th>
              <th className="whitespace-nowrap py-1.5 pr-3 text-right font-semibold">비율</th>
            </tr>
          </thead>
          <tbody>
            {options.map((opt) => {
              const count = combined[opt.value] ?? 0;
              const pct = total > 0 ? Math.round((count / total) * 100) : 0;
              return (
                <tr key={opt.value} className="border-b border-neutral-50">
                  <td className="whitespace-nowrap py-1.5 pr-3 text-neutral-700">{opt.label}</td>
                  <td className="whitespace-nowrap py-1.5 pr-3 text-right font-bold text-sh-blue">{count}</td>
                  <td className="whitespace-nowrap py-1.5 pr-3 text-right text-neutral-500">{pct}%</td>
                </tr>
              );
            })}
            <tr className="text-neutral-400">
              <td className="whitespace-nowrap py-1.5 pr-3 font-semibold">합계</td>
              <td className="whitespace-nowrap py-1.5 pr-3 text-right font-semibold">{total}</td>
              <td className="whitespace-nowrap py-1.5 pr-3 text-right font-semibold">100%</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}

function CrossTabTable({
  title,
  note,
  rowOptions,
  colOptions,
  data,
}: {
  title: string;
  note: string;
  rowOptions: SurveyOption[];
  colOptions: SurveyOption[];
  data: Record<string, CountMap> | undefined;
}) {
  if (!data) return null;
  return (
    <div className="rounded-2xl border border-neutral-200 bg-white p-5">
      <div className="text-[13px] font-bold leading-snug text-neutral-900">{title}</div>
      <p className="mt-1 text-[11.5px] text-neutral-400">{note}</p>
      <div className="mt-3 overflow-x-auto">
        <table className="w-full text-left text-[12.5px]">
          <thead>
            <tr className="border-b border-neutral-100 text-neutral-400">
              <th className="whitespace-nowrap py-1.5 pr-3 font-semibold"></th>
              {colOptions.map((c) => (
                <th key={c.value} className="whitespace-nowrap py-1.5 pr-3 text-right font-semibold">
                  {c.label}
                </th>
              ))}
              <th className="whitespace-nowrap py-1.5 pr-3 text-right font-semibold">합계</th>
            </tr>
          </thead>
          <tbody>
            {rowOptions.map((r) => {
              const bucket = data[r.value] ?? {};
              const rowVals = colOptions.map((c) => bucket[c.value] ?? 0);
              const sum = rowVals.reduce((a, b) => a + b, 0);
              return (
                <tr key={r.value} className="border-b border-neutral-50">
                  <td className="whitespace-nowrap py-1.5 pr-3 text-neutral-700">{r.label}</td>
                  {rowVals.map((v, i) => (
                    <td key={i} className="whitespace-nowrap py-1.5 pr-3 text-right text-neutral-600">
                      {v || <span className="text-neutral-200">-</span>}
                    </td>
                  ))}
                  <td className="whitespace-nowrap py-1.5 pr-3 text-right font-bold text-sh-blue">{sum}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function StatsPage() {
  const [stats, setStats] = useState<DetailedStats | null>(null);
  const image = useImageDownload("SH_LUCKY_DRAW_설문통계");

  useEffect(() => {
    fetch("/api/admin/stats/detailed")
      .then((res) => res.json())
      .then(setStats);
  }, []);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h2 className="text-[16px] font-bold text-neutral-900">설문 통계 분석</h2>
        <div className="flex items-center gap-2">
          <button
            onClick={image.handleDownload}
            disabled={image.saving}
            className="whitespace-nowrap rounded-lg border border-neutral-200 bg-white px-4 py-2 text-[13px] font-bold text-neutral-600 disabled:opacity-40"
          >
            {image.saving ? "저장 중..." : "이미지 다운로드"}
          </button>
          <a
            href="/api/admin/stats/detailed/export"
            className="whitespace-nowrap rounded-lg bg-sh-blue px-4 py-2 text-[13px] font-bold text-white"
          >
            Excel 다운로드
          </a>
        </div>
      </div>

      {!stats ? (
        <div className="rounded-2xl border border-neutral-200 bg-white p-10 text-center text-neutral-300">
          불러오는 중...
        </div>
      ) : (
        <div ref={image.ref} className="flex flex-col gap-6 bg-neutral-50 p-1">
          <div>
            <div className="mb-3 flex items-center gap-2">
              <span className="rounded-full bg-sh-blue/10 px-2.5 py-1 text-[11px] font-bold text-sh-blue">
                전체 응답 현황
              </span>
              <p className="text-[12px] text-neutral-400">1~{Math.max(...stats.rounds, 1)}차 전체 합계 기준입니다.</p>
            </div>
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              <BreakdownTable
                title={SURVEY_QUESTIONS[0].title.replace(/\n/g, " ")}
                options={SURVEY_QUESTIONS[0].options}
                data={stats.byRound.survey_answer_1}
              />
              <BreakdownTable
                title={SURVEY_QUESTIONS[1].title.replace(/\n/g, " ")}
                options={SURVEY_QUESTIONS[1].options}
                data={stats.byRound.survey_answer_2}
              />
              <BreakdownTable title="직무 분야" options={JOB_ROLE_OPTIONS} data={stats.byRound.job_role} />
              <BreakdownTable
                title="기업부설연구소 / R&D 전담부서 보유 여부"
                options={RND_DEPT_OPTIONS}
                data={stats.byRound.rnd_dept}
              />
              <BreakdownTable
                title="본사 / 연구실 위치"
                options={HQ_LOCATION_OPTIONS}
                data={stats.byRound.hq_location}
              />
            </div>
          </div>

          <div>
            <div className="mb-3 flex items-center gap-2">
              <span className="rounded-full bg-sh-blue/10 px-2.5 py-1 text-[11px] font-bold text-sh-blue">
                교차분석
              </span>
              <p className="text-[12px] text-neutral-400">응답자 특성별로 관심사가 어떻게 갈리는지 봅니다.</p>
            </div>
            <div className="grid grid-cols-1 gap-4">
              <CrossTabTable
                title="관심 부지 x 본사/연구실 위치"
                note="어느 지역 소재 기업이 어떤 부지를 선호하는지 확인할 수 있습니다."
                rowOptions={SURVEY_QUESTIONS[0].options}
                colOptions={HQ_LOCATION_OPTIONS}
                data={stats.crossTabs.q1ByHqLocation}
              />
              <CrossTabTable
                title="관심 부지 x R&D 전담부서 보유 여부"
                note="R&D 조직 보유 기업이 특정 부지를 더 선호하는지 확인할 수 있습니다."
                rowOptions={SURVEY_QUESTIONS[0].options}
                colOptions={RND_DEPT_OPTIONS}
                data={stats.crossTabs.q1ByRndDept}
              />
              <CrossTabTable
                title="입주 결정 요소 x 직무 분야"
                note="직무별로 중요하게 여기는 입주 결정 요소가 다른지 확인할 수 있습니다."
                rowOptions={SURVEY_QUESTIONS[1].options}
                colOptions={JOB_ROLE_OPTIONS}
                data={stats.crossTabs.q2ByJobRole}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
