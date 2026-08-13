import { NextResponse } from "next/server";
import * as XLSX from "xlsx";
import { getSupabaseServiceClient } from "@/lib/supabase/server";
import { requireAdminResponse } from "@/lib/auth/guard";
import { formatTicketNumber } from "@/lib/utils/ticket-number";
import {
  HQ_LOCATION_OPTIONS,
  JOB_ROLE_OPTIONS,
  RND_DEPT_OPTIONS,
  RND_RELOCATION_OPTIONS,
  optionLabel,
} from "@/lib/config/survey-questions";

export const dynamic = "force-dynamic";

export async function GET() {
  const unauthorized = requireAdminResponse();
  if (unauthorized) return unauthorized;

  const supabase = getSupabaseServiceClient();
  const { data, error } = await supabase
    .from("participants")
    .select(
      "ticket_number, created_at, name, company, job_role, rnd_dept, rnd_dept_name, rnd_relocation_plan, hq_location, hq_location_other, phone, email, survey_answer_1, survey_answer_2, drawn_at, received, received_at, is_test, prizes(rank, name)"
    )
    .order("ticket_number", { ascending: true });

  if (error) {
    console.error("export error:", error);
    return NextResponse.json({ error: "UNKNOWN" }, { status: 500 });
  }

  const rows = (data ?? []).map((p: any) => ({
    응모번호: formatTicketNumber(p.ticket_number),
    참여시간: p.created_at ? new Date(p.created_at).toLocaleString("ko-KR") : "",
    이름: p.name,
    회사: p.company ?? "",
    직무: optionLabel(JOB_ROLE_OPTIONS, p.job_role),
    "R&D부서보유여부": optionLabel(RND_DEPT_OPTIONS, p.rnd_dept),
    "R&D부서명": p.rnd_dept_name ?? "",
    "R&D이전확장계획": optionLabel(RND_RELOCATION_OPTIONS, p.rnd_relocation_plan),
    본사연구실위치:
      p.hq_location === "etc"
        ? `기타 지역(${p.hq_location_other ?? ""})`
        : optionLabel(HQ_LOCATION_OPTIONS, p.hq_location),
    휴대전화: p.phone,
    이메일: p.email,
    설문1: p.survey_answer_1,
    설문2: p.survey_answer_2,
    추첨여부: p.drawn_at ? "추첨완료" : "미추첨",
    당첨등수: p.prizes?.rank ?? "",
    당첨상품: p.prizes?.name ?? "",
    추첨시간: p.drawn_at ? new Date(p.drawn_at).toLocaleString("ko-KR") : "",
    상품수령여부: p.received ? "수령완료" : "미수령",
    상품수령시간: p.received_at ? new Date(p.received_at).toLocaleString("ko-KR") : "",
    테스트데이터: p.is_test ? "TEST" : "",
  }));

  const worksheet = XLSX.utils.json_to_sheet(rows);
  worksheet["!cols"] = [
    { wch: 10 }, { wch: 20 }, { wch: 12 }, { wch: 18 }, { wch: 14 },
    { wch: 16 }, { wch: 18 }, { wch: 16 }, { wch: 22 }, { wch: 15 },
    { wch: 24 }, { wch: 18 }, { wch: 16 }, { wch: 10 }, { wch: 10 },
    { wch: 20 }, { wch: 20 }, { wch: 12 }, { wch: 20 }, { wch: 10 },
  ];

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "참가자명단");

  // 한글 인코딩 깨짐 방지를 위해 UTF-8 BOM 포함 buffer로 생성한다.
  const buffer = XLSX.write(workbook, { type: "buffer", bookType: "xlsx" });

  const today = new Date();
  const dateStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(
    today.getDate()
  ).padStart(2, "0")}`;
  const filename = `SH_AI_EXPO_LUCKY_DRAW_${dateStr}.xlsx`;

  return new NextResponse(buffer, {
    status: 200,
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${encodeURIComponent(filename)}"`,
    },
  });
}
