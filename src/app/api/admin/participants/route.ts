import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServiceClient } from "@/lib/supabase/server";
import { requireAdminResponse } from "@/lib/auth/guard";

export const dynamic = "force-dynamic";

// filter: all | not_drawn | drawn | rank1 | rank2 | rank3 | rank4 | rank5
export async function GET(req: NextRequest) {
  const unauthorized = requireAdminResponse();
  if (unauthorized) return unauthorized;

  const { searchParams } = new URL(req.url);
  const q = searchParams.get("q")?.trim() ?? "";
  const filter = searchParams.get("filter") ?? "all";
  const page = Math.max(1, Number(searchParams.get("page") ?? "1"));
  const pageSize = Math.min(200, Math.max(1, Number(searchParams.get("pageSize") ?? "50")));

  const supabase = getSupabaseServiceClient();

  let query = supabase
    .from("participants")
    .select(
      "id, ticket_number, name, company, job_role, rnd_dept, rnd_dept_name, rnd_relocation_plan, hq_location, hq_location_other, phone, email, survey_answer_1, survey_answer_2, created_at, drawn_at, prize_id, received, received_at, is_test, prizes(rank, name)",
      { count: "exact" }
    )
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
    if (rank >= 1 && rank <= 5) {
      const { data: prize } = await supabase.from("prizes").select("id").eq("rank", rank).maybeSingle();
      if (prize) {
        query = query.eq("prize_id", prize.id);
      } else {
        query = query.eq("prize_id", "00000000-0000-0000-0000-000000000000");
      }
    }
  }

  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;
  query = query.range(from, to);

  const { data, count, error } = await query;

  if (error) {
    console.error("participants list error:", error);
    return NextResponse.json({ error: "UNKNOWN" }, { status: 500 });
  }

  return NextResponse.json({
    participants: data ?? [],
    total: count ?? 0,
    page,
    pageSize,
  });
}
