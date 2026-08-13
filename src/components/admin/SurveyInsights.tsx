"use client";

import {
  HQ_LOCATION_OPTIONS,
  RND_DEPT_OPTIONS,
  SURVEY_QUESTIONS,
  type SurveyOption,
} from "@/lib/config/survey-questions";

export type SurveyStats = {
  surveyAnswer1Counts: Record<string, number>;
  surveyAnswer2Counts: Record<string, number>;
  rndDeptCounts: Record<string, number>;
  hqLocationCounts: Record<string, number>;
};

function BreakdownCard({
  title,
  options,
  counts,
}: {
  title: string;
  options: SurveyOption[];
  counts: Record<string, number>;
}) {
  const total = Object.values(counts).reduce((a, b) => a + b, 0);
  return (
    <div className="rounded-2xl border border-neutral-200 bg-white p-5">
      <div className="text-[13px] font-bold leading-snug text-neutral-900">{title}</div>
      <div className="mt-4 flex flex-col gap-3">
        {options.map((opt) => {
          const count = counts[opt.value] ?? 0;
          const pct = total > 0 ? Math.round((count / total) * 100) : 0;
          return (
            <div key={opt.value}>
              <div className="flex items-center justify-between gap-3 text-[12.5px]">
                <span className="text-neutral-600">{opt.label}</span>
                <span className="whitespace-nowrap font-bold text-neutral-900">
                  {count}명 <span className="font-normal text-neutral-400">({pct}%)</span>
                </span>
              </div>
              <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-neutral-100">
                <div
                  className="h-full rounded-full bg-sh-blue transition-all duration-500"
                  style={{ width: `${pct}%` }}
                />
              </div>
            </div>
          );
        })}
        {total === 0 && <div className="text-[12px] text-neutral-300">아직 응답이 없습니다.</div>}
      </div>
    </div>
  );
}

export function SurveyInsights({ stats }: { stats: SurveyStats | null }) {
  return (
    <div>
      <div className="mb-3 flex items-center gap-2">
        <span className="rounded-full bg-sh-blue/10 px-2.5 py-1 text-[11px] font-bold text-sh-blue">
          핵심 데이터
        </span>
        <h2 className="text-[15px] font-bold text-neutral-900">
          설문 응답 현황 <span className="font-normal text-neutral-400">— 마곡 산업단지 수요조사</span>
        </h2>
      </div>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <BreakdownCard
          title={SURVEY_QUESTIONS[0].title.replace(/\n/g, " ")}
          options={SURVEY_QUESTIONS[0].options}
          counts={stats?.surveyAnswer1Counts ?? {}}
        />
        <BreakdownCard
          title={SURVEY_QUESTIONS[1].title.replace(/\n/g, " ")}
          options={SURVEY_QUESTIONS[1].options}
          counts={stats?.surveyAnswer2Counts ?? {}}
        />
        <BreakdownCard
          title="기업부설연구소 / R&D 전담부서 보유 여부"
          options={RND_DEPT_OPTIONS}
          counts={stats?.rndDeptCounts ?? {}}
        />
        <BreakdownCard
          title="본사 / 연구실 위치"
          options={HQ_LOCATION_OPTIONS}
          counts={stats?.hqLocationCounts ?? {}}
        />
      </div>
    </div>
  );
}
