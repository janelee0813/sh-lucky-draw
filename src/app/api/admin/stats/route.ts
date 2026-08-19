import { NextResponse } from "next/server";
import { getSupabaseServiceClient } from "@/lib/supabase/server";
import { requireAdminResponse } from "@/lib/auth/guard";

export const dynamic = "force-dynamic";

// 대시보드는 라이브(현재 라운드) + 보관된 지난 라운드 전체를 합산해서 보여준다.
// (요청: "대시보드에서는 1,2차 결과를 통합해서" 반영)
// 단, remainingPrizes(남은 상품)는 지금 실제로 뽑을 수 있는 라이브 재고만 의미가 있으므로
// 라이브 기준으로만 계산한다.
export async function GET() {
  const unauthorized = requireAdminResponse();
  if (unauthorized) return unauthorized;

  const supabase = getSupabaseServiceClient();

  const [
    { count: liveTotal },
    { count: liveDrawn },
    { data: livePrizes },
    { data: liveSurveyRows },
    { count: archivedTotal },
    { count: archivedDrawn },
    { data: archivedPrizes },
    { data: archivedSurveyRows },
  ] = await Promise.all([
    supabase.from("participants").select("id", { count: "exact", head: true }),
    supabase.from("participants").select("id", { count: "exact", head: true }).not("drawn_at", "is", null),
    supabase.from("prizes").select("rank, name, initial_quantity, remaining_quantity, display_order").order("display_order"),
    // 설문 응답/기업 정보 집계용 - 개인정보(이름/연락처 등)는 조회하지 않는다.
    supabase.from("participants").select("survey_answer_1, survey_answer_2, job_role, rnd_dept, hq_location"),
    supabase.from("participants_archive").select("id", { count: "exact", head: true }),
    supabase.from("participants_archive").select("id", { count: "exact", head: true }).not("drawn_at", "is", null),
    supabase.from("prizes_archive").select("rank, name, initial_quantity, remaining_quantity, display_order"),
    supabase.from("participants_archive").select("survey_answer_1, survey_answer_2, job_role, rnd_dept, hq_location"),
  ]);

  const total = (liveTotal ?? 0) + (archivedTotal ?? 0);
  const drawn = (liveDrawn ?? 0) + (archivedDrawn ?? 0);
  const remaining = (livePrizes ?? []).reduce((sum, p) => sum + p.remaining_quantity, 0);

  type SurveyRow = { survey_answer_1: string | null; survey_answer_2: string | null; job_role: string | null; rnd_dept: string | null; hq_location: string | null };

  function countBy(key: "survey_answer_1" | "survey_answer_2" | "job_role" | "rnd_dept" | "hq_location", ...rowSets: (SurveyRow[] | null)[]) {
    const counts: Record<string, number> = {};
    for (const rows of rowSets) {
      for (const row of rows ?? []) {
        const value = row[key];
        if (!value) continue;
        counts[value] = (counts[value] ?? 0) + 1;
      }
    }
    return counts;
  }

  // 등수+상품명 기준으로 지난 라운드들과 현재 라운드의 수량을 합산한다.
  // (라운드 전환 시 상품명을 그대로 유지하는 걸 전제로 하므로, 이름이 바뀌면 별도 행으로 표시된다)
  type PrizeRow = { rank: number; name: string; initial_quantity: number; remaining_quantity: number; display_order: number };
  const prizeMap = new Map<string, { rank: number; name: string; display_order: number; initial_quantity: number; won_quantity: number; remaining_quantity: number }>();
  function addPrizeRows(rows: PrizeRow[] | null, countsAsRemaining: boolean) {
    for (const p of rows ?? []) {
      const key = `${p.rank}__${p.name}`;
      const existing = prizeMap.get(key) ?? {
        rank: p.rank,
        name: p.name,
        display_order: p.display_order,
        initial_quantity: 0,
        won_quantity: 0,
        remaining_quantity: 0,
      };
      existing.initial_quantity += p.initial_quantity;
      existing.won_quantity += p.initial_quantity - p.remaining_quantity;
      if (countsAsRemaining) existing.remaining_quantity += p.remaining_quantity;
      prizeMap.set(key, existing);
    }
  }
  addPrizeRows(archivedPrizes, false);
  addPrizeRows(livePrizes, true);
  const prizeBreakdown = Array.from(prizeMap.values()).sort((a, b) => a.display_order - b.display_order);

  return NextResponse.json({
    totalParticipants: total,
    drawnCount: drawn,
    pendingDrawCount: total - drawn,
    remainingPrizes: remaining,
    prizeBreakdown,
    surveyAnswer1Counts: countBy("survey_answer_1", liveSurveyRows, archivedSurveyRows),
    surveyAnswer2Counts: countBy("survey_answer_2", liveSurveyRows, archivedSurveyRows),
    jobRoleCounts: countBy("job_role", liveSurveyRows, archivedSurveyRows),
    rndDeptCounts: countBy("rnd_dept", liveSurveyRows, archivedSurveyRows),
    hqLocationCounts: countBy("hq_location", liveSurveyRows, archivedSurveyRows),
  });
}
