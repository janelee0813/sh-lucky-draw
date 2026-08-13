import { NextResponse } from "next/server";
import * as XLSX from "xlsx";
import { getSupabaseServiceClient } from "@/lib/supabase/server";
import { requireAdminResponse } from "@/lib/auth/guard";
import {
  HQ_LOCATION_OPTIONS,
  JOB_ROLE_OPTIONS,
  RND_DEPT_OPTIONS,
  SURVEY_QUESTIONS,
  type SurveyOption,
} from "@/lib/config/survey-questions";

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
    supabase.from("prizes").select("rank, name, initial_quantity, remaining_quantity").order("display_order"),
    supabase.from("participants").select("survey_answer_1, survey_answer_2, job_role, rnd_dept, hq_location"),
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

  const a1 = countBy("survey_answer_1");
  const a2 = countBy("survey_answer_2");
  const jobRole = countBy("job_role");
  const rndDept = countBy("rnd_dept");
  const hqLocation = countBy("hq_location");

  const rows: (string | number)[][] = [];
  rows.push(["SH AI Summit Seoul & Expo LUCKY DRAW - 대시보드 통계"]);
  rows.push([]);
  rows.push(["총 참여", total]);
  rows.push(["추첨 완료", drawn]);
  rows.push(["추첨 대기", total - drawn]);
  rows.push(["남은 상품", remaining]);
  rows.push([]);

  rows.push(["상품 재고"]);
  rows.push(["등수", "상품명", "초기수량", "남은수량"]);
  for (const p of prizes ?? []) {
    rows.push([`${p.rank}등`, p.name, p.initial_quantity, p.remaining_quantity]);
  }
  rows.push([]);

  function pushBreakdown(title: string, options: SurveyOption[], counts: Record<string, number>) {
    const sectionTotal = Object.values(counts).reduce((a, b) => a + b, 0);
    rows.push([title]);
    rows.push(["항목", "응답 수", "비율"]);
    for (const opt of options) {
      const count = counts[opt.value] ?? 0;
      const pct = sectionTotal > 0 ? Math.round((count / sectionTotal) * 100) : 0;
      rows.push([opt.label, count, `${pct}%`]);
    }
    rows.push([]);
  }

  pushBreakdown(`Q1. ${SURVEY_QUESTIONS[0].title.replace(/\n/g, " ")}`, SURVEY_QUESTIONS[0].options, a1);
  pushBreakdown(`Q2. ${SURVEY_QUESTIONS[1].title.replace(/\n/g, " ")}`, SURVEY_QUESTIONS[1].options, a2);
  pushBreakdown("직무 분야", JOB_ROLE_OPTIONS, jobRole);
  pushBreakdown("기업부설연구소 / R&D 전담부서 보유 여부", RND_DEPT_OPTIONS, rndDept);
  pushBreakdown("본사 / 연구실 위치", HQ_LOCATION_OPTIONS, hqLocation);

  const worksheet = XLSX.utils.aoa_to_sheet(rows);
  worksheet["!cols"] = [{ wch: 46 }, { wch: 20 }, { wch: 14 }, { wch: 12 }];

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "대시보드 통계");

  const buffer = XLSX.write(workbook, { type: "buffer", bookType: "xlsx" });

  const today = new Date();
  const dateStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(
    today.getDate()
  ).padStart(2, "0")}`;
  const filename = `SH_LUCKY_DRAW_대시보드통계_${dateStr}.xlsx`;

  return new NextResponse(buffer, {
    status: 200,
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${encodeURIComponent(filename)}"`,
    },
  });
}
