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

  const selectCols =
    "ticket_number, created_at, name, company, job_role, rnd_dept, rnd_dept_name, rnd_relocation_plan, hq_location, hq_location_other, phone, email, survey_answer_1, survey_answer_2, drawn_at, received, received_at, is_test, prize_id";

  const [{ data: settings }, { data: liveParticipants }, { data: livePrizes }, { data: archivedParticipants }, { data: archivedPrizes }] =
    await Promise.all([
      supabase.from("event_settings").select("current_round").eq("id", 1).maybeSingle(),
      supabase.from("participants").select(selectCols),
      supabase.from("prizes").select("id, rank, name"),
      supabase.from("participants_archive").select(`${selectCols}, archived_round`),
      supabase.from("prizes_archive").select("id, rank, name"),
    ]);

  const currentRound = settings?.current_round ?? 1;
  const prizeMap = new Map<string, { rank: number; name: string }>();
  for (const p of [...(livePrizes ?? []), ...(archivedPrizes ?? [])]) {
    prizeMap.set(p.id, { rank: p.rank, name: p.name });
  }

  const combined = [
    ...(liveParticipants ?? []).map((p: any) => ({ ...p, round: currentRound })),
    ...(archivedParticipants ?? []).map((p: any) => ({ ...p, round: p.archived_round })),
  ].sort((a, b) => (a.round !== b.round ? a.round - b.round : a.ticket_number - b.ticket_number));

  const rows = combined.map((p: any) => {
    const prize = p.prize_id ? prizeMap.get(p.prize_id) : null;
    return {
      회차: `${p.round}차`,
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
      당첨등수: prize?.rank ?? "",
      당첨상품: prize?.name ?? "",
      추첨시간: p.drawn_at ? new Date(p.drawn_at).toLocaleString("ko-KR") : "",
      상품수령여부: p.received ? "수령완료" : "미수령",
      상품수령시간: p.received_at ? new Date(p.received_at).toLocaleString("ko-KR") : "",
      테스트데이터: p.is_test ? "TEST" : "",
    };
  });

  const worksheet = XLSX.utils.json_to_sheet(rows);
  worksheet["!cols"] = [
    { wch: 8 }, { wch: 10 }, { wch: 20 }, { wch: 12 }, { wch: 18 }, { wch: 14 },
    { wch: 16 }, { wch: 18 }, { wch: 16 }, { wch: 22 }, { wch: 15 },
    { wch: 24 }, { wch: 18 }, { wch: 16 }, { wch: 10 }, { wch: 10 },
    { wch: 20 }, { wch: 20 }, { wch: 12 }, { wch: 20 }, { wch: 10 },
  ];

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "전체 참가자명단");

  const buffer = XLSX.write(workbook, { type: "buffer", bookType: "xlsx" });

  const today = new Date();
  const dateStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(
    today.getDate()
  ).padStart(2, "0")}`;
  const filename = `SH_AI_EXPO_LUCKY_DRAW_전체_${dateStr}.xlsx`;

  return new NextResponse(buffer, {
    status: 200,
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${encodeURIComponent(filename)}"`,
    },
  });
}
