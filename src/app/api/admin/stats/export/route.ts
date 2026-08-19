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

// 화면(DASHBOARD)과 동일하게 1차(보관) + 2차(라이브) 합산 수치로 내려받는다.
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

  type PrizeRow = { rank: number; name: string; initial_quantity: number; remaining_quantity: number; display_order: number };
  const prizeMap = new Map<string, { rank: number; name: string; display_order: number; initial_quantity: number; remaining_quantity: number }>();
  function addPrizeRows(rows: PrizeRow[] | null, countsAsRemaining: boolean) {
    for (const p of rows ?? []) {
      const key = `${p.rank}__${p.name}`;
      const existing = prizeMap.get(key) ?? {
        rank: p.rank,
        name: p.name,
        display_order: p.display_order,
        initial_quantity: 0,
        remaining_quantity: 0,
      };
      existing.initial_quantity += p.initial_quantity;
      if (countsAsRemaining) existing.remaining_quantity += p.remaining_quantity;
      prizeMap.set(key, existing);
    }
  }
  addPrizeRows(archivedPrizes, false);
  addPrizeRows(livePrizes, true);
  const prizes = Array.from(prizeMap.values()).sort((a, b) => a.display_order - b.display_order);

  const a1 = countBy("survey_answer_1", liveSurveyRows, archivedSurveyRows);
  const a2 = countBy("survey_answer_2", liveSurveyRows, archivedSurveyRows);
  const jobRole = countBy("job_role", liveSurveyRows, archivedSurveyRows);
  const rndDept = countBy("rnd_dept", liveSurveyRows, archivedSurveyRows);
  const hqLocation = countBy("hq_location", liveSurveyRows, archivedSurveyRows);

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
