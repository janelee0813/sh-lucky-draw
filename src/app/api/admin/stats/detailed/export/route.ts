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

type SurveyRow = {
  round: number;
  survey_answer_1: string | null;
  survey_answer_2: string | null;
  job_role: string | null;
  rnd_dept: string | null;
  hq_location: string | null;
};

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

  function byRound(key: keyof SurveyRow) {
    const result: Record<number, Record<string, number>> = {};
    for (const round of rounds) result[round] = {};
    for (const row of rows) {
      const value = row[key];
      if (!value) continue;
      result[row.round][value as string] = (result[row.round][value as string] ?? 0) + 1;
    }
    return result;
  }

  function crossTab(rowKey: keyof SurveyRow, colKey: keyof SurveyRow) {
    const result: Record<string, Record<string, number>> = {};
    for (const row of rows) {
      const rv = row[rowKey];
      const cv = row[colKey];
      if (!rv || !cv) continue;
      if (!result[rv as string]) result[rv as string] = {};
      result[rv as string][cv as string] = (result[rv as string][cv as string] ?? 0) + 1;
    }
    return result;
  }

  const workbook = XLSX.utils.book_new();

  function addRoundSheet(sheetName: string, options: SurveyOption[], key: keyof SurveyRow) {
    const data = byRound(key);
    const header = ["항목", ...rounds.map((r) => `${r}차`), "합계"];
    const aoa: (string | number)[][] = [header];
    for (const opt of options) {
      const rowVals = rounds.map((r) => data[r][opt.value] ?? 0);
      const sum = rowVals.reduce((a, b) => a + b, 0);
      aoa.push([opt.label, ...rowVals, sum]);
    }
    const totalRow = rounds.map((r) => Object.values(data[r]).reduce((a, b) => a + b, 0));
    aoa.push(["합계", ...totalRow, totalRow.reduce((a, b) => a + b, 0)]);
    const ws = XLSX.utils.aoa_to_sheet(aoa);
    ws["!cols"] = [{ wch: 34 }, ...rounds.map(() => ({ wch: 10 })), { wch: 10 }];
    XLSX.utils.book_append_sheet(workbook, ws, sheetName);
  }

  addRoundSheet("Q1 라운드별", SURVEY_QUESTIONS[0].options, "survey_answer_1");
  addRoundSheet("Q2 라운드별", SURVEY_QUESTIONS[1].options, "survey_answer_2");
  addRoundSheet("직무 라운드별", JOB_ROLE_OPTIONS, "job_role");
  addRoundSheet("RD보유 라운드별", RND_DEPT_OPTIONS, "rnd_dept");
  addRoundSheet("본사위치 라운드별", HQ_LOCATION_OPTIONS, "hq_location");

  function addCrossTabSheet(
    sheetName: string,
    rowOptions: SurveyOption[],
    colOptions: SurveyOption[],
    data: Record<string, Record<string, number>>
  ) {
    const header = ["", ...colOptions.map((c) => c.label), "합계"];
    const aoa: (string | number)[][] = [header];
    for (const r of rowOptions) {
      const bucket = data[r.value] ?? {};
      const rowVals = colOptions.map((c) => bucket[c.value] ?? 0);
      const sum = rowVals.reduce((a, b) => a + b, 0);
      aoa.push([r.label, ...rowVals, sum]);
    }
    const ws = XLSX.utils.aoa_to_sheet(aoa);
    ws["!cols"] = [{ wch: 30 }, ...colOptions.map(() => ({ wch: 14 })), { wch: 10 }];
    XLSX.utils.book_append_sheet(workbook, ws, sheetName);
  }

  addCrossTabSheet(
    "Q1x본사위치",
    SURVEY_QUESTIONS[0].options,
    HQ_LOCATION_OPTIONS,
    crossTab("survey_answer_1", "hq_location")
  );
  addCrossTabSheet(
    "Q1xRD보유",
    SURVEY_QUESTIONS[0].options,
    RND_DEPT_OPTIONS,
    crossTab("survey_answer_1", "rnd_dept")
  );
  addCrossTabSheet(
    "Q2x직무",
    SURVEY_QUESTIONS[1].options,
    JOB_ROLE_OPTIONS,
    crossTab("survey_answer_2", "job_role")
  );

  const buffer = XLSX.write(workbook, { type: "buffer", bookType: "xlsx" });

  const today = new Date();
  const dateStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(
    today.getDate()
  ).padStart(2, "0")}`;
  const filename = `SH_AI_EXPO_LUCKY_DRAW_설문통계_${dateStr}.xlsx`;

  return new NextResponse(buffer, {
    status: 200,
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${encodeURIComponent(filename)}"`,
    },
  });
}
