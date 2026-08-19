import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServiceClient } from "@/lib/supabase/server";
import { requireAdminResponse } from "@/lib/auth/guard";

export const dynamic = "force-dynamic";

type Row = {
  id: string;
  ticket_number: number;
  round: number;
  name: string;
  company: string | null;
  phone: string;
  email: string;
  drawn_at: string | null;
  prize_id: string | null;
  [key: string]: unknown;
};

// 라이브(현재 라운드) + 보관된 지난 라운드 전체를 하나로 합쳐서 보여준다.
// 라운드마다 다른 테이블에 나눠져 있어 DB 쿼리 하나로는 안 되므로, 전체를 불러온 뒤
// 검색/필터/페이지네이션을 메모리에서 처리한다 (행사 규모상 전체 합쳐도 수천 건 이내).
export async function GET(req: NextRequest) {
  const unauthorized = requireAdminResponse();
  if (unauthorized) return unauthorized;

  const { searchParams } = new URL(req.url);
  const q = searchParams.get("q")?.trim().toLowerCase() ?? "";
  const filter = searchParams.get("filter") ?? "all";
  const page = Math.max(1, Number(searchParams.get("page") ?? "1"));
  const pageSize = Math.min(200, Math.max(1, Number(searchParams.get("pageSize") ?? "50")));

  const supabase = getSupabaseServiceClient();

  const selectCols =
    "id, ticket_number, name, company, job_role, rnd_dept, rnd_dept_name, rnd_relocation_plan, hq_location, hq_location_other, phone, email, survey_answer_1, survey_answer_2, created_at, drawn_at, prize_id, received, received_at, is_test";

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

  const combined: Row[] = [
    ...(liveParticipants ?? []).map((p: any) => ({ ...p, round: currentRound })),
    ...(archivedParticipants ?? []).map((p: any) => ({ ...p, round: p.archived_round })),
  ];

  let filtered = combined;
  if (q) {
    filtered = filtered.filter(
      (r) =>
        String(r.ticket_number).includes(q) ||
        (r.phone || "").toLowerCase().includes(q) ||
        (r.name || "").toLowerCase().includes(q) ||
        (r.company || "").toLowerCase().includes(q) ||
        (r.email || "").toLowerCase().includes(q)
    );
  }
  if (filter === "not_drawn") {
    filtered = filtered.filter((r) => !r.drawn_at);
  } else if (filter === "drawn") {
    filtered = filtered.filter((r) => !!r.drawn_at);
  } else if (filter.startsWith("rank")) {
    const rank = Number(filter.replace("rank", ""));
    filtered = filtered.filter((r) => r.prize_id && prizeMap.get(r.prize_id)?.rank === rank);
  }

  filtered = filtered.sort((a, b) => (b.round !== a.round ? b.round - a.round : b.ticket_number - a.ticket_number));

  const total = filtered.length;
  const from = (page - 1) * pageSize;
  const participants = filtered.slice(from, from + pageSize).map((r) => ({
    ...r,
    prizes: r.prize_id ? prizeMap.get(r.prize_id) ?? null : null,
  }));

  return NextResponse.json({ participants, total, page, pageSize });
}
