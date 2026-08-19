import { NextResponse } from "next/server";
import { getSupabaseServiceClient } from "@/lib/supabase/server";
import { requireAdminResponse } from "@/lib/auth/guard";

export const dynamic = "force-dynamic";

type SurveyRow = {
  round: number;
  survey_answer_1: string | null;
  survey_answer_2: string | null;
  job_role: string | null;
  rnd_dept: string | null;
  hq_location: string | null;
};

// 실제 설문 분석에 쓸 수 있도록 대시보드보다 더 깊은 통계를 제공한다.
// - 라운드별 비교(1~N차 각각의 응답 분포)
// - 교차분석(관심 부지 x 본사위치, 관심 부지 x R&D보유여부, 입주결정요소 x 직무분야)
export async function GET() {
  const unauthorized = requireAdminResponse();
  if (unauthorized) return unauthorized;

  const supabase = getSupabaseServiceClient();

  const selectCols = "survey_answer_1, survey_answer_2, job_role, rnd_dept, hq_location";

  const [{ data: settings }, { data: liveRows }, { data: archivedRows }] = await Promise.all([
    supabase.from("event_settings").select("current_round").eq("id", 1).maybeSingle(),
    supabase.from("participants").select(selectCols),
    supabase.from("participants_archive").select(`${selectCols}, archived_round`),
  ]);

  const currentRound = settings?.current_round ?? 1;

  const rows: SurveyRow[] = [
    ...(liveRows ?? []).map((r: any) => ({ ...r, round: currentRound })),
    ...(archivedRows ?? []).map((r: any) => ({ ...r, round: r.archived_round })),
  ];

  const rounds = Array.from(new Set(rows.map((r) => r.round))).sort((a, b) => a - b);

  // 라운드별 비교: dimension(설문항목) -> round -> value -> count
  function byRound(key: keyof SurveyRow) {
    const result: Record<number, Record<string, number>> = {};
    for (const round of rounds) result[round] = {};
    for (const row of rows) {
      const value = row[key];
      if (!value) continue;
      const bucket = result[row.round];
      bucket[value as string] = (bucket[value as string] ?? 0) + 1;
    }
    return result;
  }

  // 교차분석: rowKey 값 -> colKey 값 -> count
  function crossTab(rowKey: keyof SurveyRow, colKey: keyof SurveyRow) {
    const result: Record<string, Record<string, number>> = {};
    for (const row of rows) {
      const rv = row[rowKey];
      const cv = row[colKey];
      if (!rv || !cv) continue;
      if (!result[rv as string]) result[rv as string] = {};
      const bucket = result[rv as string];
      bucket[cv as string] = (bucket[cv as string] ?? 0) + 1;
    }
    return result;
  }

  return NextResponse.json({
    rounds,
    byRound: {
      survey_answer_1: byRound("survey_answer_1"),
      survey_answer_2: byRound("survey_answer_2"),
      job_role: byRound("job_role"),
      rnd_dept: byRound("rnd_dept"),
      hq_location: byRound("hq_location"),
    },
    crossTabs: {
      q1ByHqLocation: crossTab("survey_answer_1", "hq_location"),
      q1ByRndDept: crossTab("survey_answer_1", "rnd_dept"),
      q2ByJobRole: crossTab("survey_answer_2", "job_role"),
    },
  });
}
