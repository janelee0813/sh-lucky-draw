import { NextResponse } from "next/server";
import { getSupabaseServiceClient } from "@/lib/supabase/server";
import { requireAdminResponse } from "@/lib/auth/guard";

export const dynamic = "force-dynamic";

export async function GET() {
  const unauthorized = requireAdminResponse();
  if (unauthorized) return unauthorized;

  const supabase = getSupabaseServiceClient();

  const [
    { count: totalParticipants },
    { count: drawnCount },
    { data: prizes },
    { data: surveyRows },
  ] = await Promise.all([
    supabase.from("participants").select("id", { count: "exact", head: true }),
    supabase.from("participants").select("id", { count: "exact", head: true }).not("drawn_at", "is", null),
    supabase.from("prizes").select("remaining_quantity"),
    // 설문 응답/기업 정보 집계용 - 개인정보(이름/연락처 등)는 조회하지 않는다.
    supabase
      .from("participants")
      .select("survey_answer_1, survey_answer_2, job_role, rnd_dept, hq_location"),
  ]);

  const total = totalParticipants ?? 0;
  const drawn = drawnCount ?? 0;
  const remaining = (prizes ?? []).reduce((sum, p) => sum + p.remaining_quantity, 0);

  function countBy(key: "survey_answer_1" | "survey_answer_2" | "job_role" | "rnd_dept" | "hq_location") {
    const counts: Record<string, number> = {};
    for (const row of surveyRows ?? []) {
      const value = row[key];
      if (!value) continue;
      counts[value] = (counts[value] ?? 0) + 1;
    }
    return counts;
  }

  return NextResponse.json({
    totalParticipants: total,
    drawnCount: drawn,
    pendingDrawCount: total - drawn,
    remainingPrizes: remaining,
    surveyAnswer1Counts: countBy("survey_answer_1"),
    surveyAnswer2Counts: countBy("survey_answer_2"),
    jobRoleCounts: countBy("job_role"),
    rndDeptCounts: countBy("rnd_dept"),
    hqLocationCounts: countBy("hq_location"),
  });
}
