import { NextResponse } from "next/server";
import { getSupabaseServiceClient } from "@/lib/supabase/server";
import { requireAdminResponse } from "@/lib/auth/guard";

export const dynamic = "force-dynamic";

// 보관된 지난 라운드 번호 목록과 라운드별 참가자 수를 반환한다.
export async function GET() {
  const unauthorized = requireAdminResponse();
  if (unauthorized) return unauthorized;

  const supabase = getSupabaseServiceClient();
  const { data, error } = await supabase.from("participants_archive").select("archived_round");

  if (error) {
    console.error("archive rounds error:", error);
    return NextResponse.json({ error: "UNKNOWN" }, { status: 500 });
  }

  const counts = new Map<number, number>();
  for (const row of data ?? []) {
    const round = row.archived_round as number;
    counts.set(round, (counts.get(round) ?? 0) + 1);
  }

  const rounds = Array.from(counts.entries())
    .map(([round, participantCount]) => ({ round, participantCount }))
    .sort((a, b) => b.round - a.round);

  return NextResponse.json({ rounds });
}
