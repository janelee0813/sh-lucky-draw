import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServiceClient } from "@/lib/supabase/server";
import { requireAdminResponse } from "@/lib/auth/guard";

export const dynamic = "force-dynamic";

// 보관된 지난 라운드(round) 참가자 목록 조회. 라이브 participants와 달리 prizes와의
// FK 관계가 없어(보관 테이블은 구조만 복사) prize_id로 prizes_archive를 직접 매칭한다.
export async function GET(req: NextRequest) {
  const unauthorized = requireAdminResponse();
  if (unauthorized) return unauthorized;

  const { searchParams } = new URL(req.url);
  const round = Number(searchParams.get("round") ?? "1");
  const q = searchParams.get("q")?.trim() ?? "";
  const filter = searchParams.get("filter") ?? "all";
  const page = Math.max(1, Number(searchParams.get("page") ?? "1"));
  const pageSize = Math.min(200, Math.max(1, Number(searchParams.get("pageSize") ?? "50")));

  const supabase = getSupabaseServiceClient();

  const { data: archivedPrizes } = await supabase
    .from("prizes_archive")
    .select("id, rank, name")
    .eq("archived_round", round);

  const prizeMap = new Map((archivedPrizes ?? []).map((p) => [p.id, { rank: p.rank, name: p.name }]));

  let query = supabase
    .from("participants_archive")
    .select(
      "id, ticket_number, name, company, job_role, rnd_dept, rnd_dept_name, rnd_relocation_plan, hq_location, hq_location_other, phone, email, survey_answer_1, survey_answer_2, created_at, drawn_at, prize_id, received, received_at, is_test",
      { count: "exact" }
    )
    .eq("archived_round", round)
    .order("ticket_number", { ascending: false });

  if (q) {
    const isNumeric = /^\d+$/.test(q);
    if (isNumeric) {
      query = query.or(
        `ticket_number.eq.${Number(q)},phone.ilike.%${q}%,name.ilike.%${q}%,company.ilike.%${q}%,email.ilike.%${q}%`
      );
    } else {
      query = query.or(`name.ilike.%${q}%,phone.ilike.%${q}%,company.ilike.%${q}%,email.ilike.%${q}%`);
    }
  }

  if (filter === "not_drawn") {
    query = query.is("drawn_at", null);
  } else if (filter === "drawn") {
    query = query.not("drawn_at", "is", null);
  } else if (filter.startsWith("rank")) {
    const rank = Number(filter.replace("rank", ""));
    const matchingIds = (archivedPrizes ?? []).filter((p) => p.rank === rank).map((p) => p.id);
    query = query.in("prize_id", matchingIds.length ? matchingIds : ["00000000-0000-0000-0000-000000000000"]);
  }

  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;
  query = query.range(from, to);

  const { data, count, error } = await query;

  if (error) {
    console.error("archive participants list error:", error);
    return NextResponse.json({ error: "UNKNOWN" }, { status: 500 });
  }

  const participants = (data ?? []).map((p) => ({
    ...p,
    prizes: p.prize_id ? prizeMap.get(p.prize_id) ?? null : null,
  }));

  return NextResponse.json({ participants, total: count ?? 0, page, pageSize });
}
