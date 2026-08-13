import { NextResponse } from "next/server";
import { getSupabaseServiceClient } from "@/lib/supabase/server";
import { MAX_PARTICIPANTS } from "@/lib/config/settings";

export const dynamic = "force-dynamic";

// 개인정보를 포함하지 않는 공개 API.
// - 상품별 재고 현황
// - 전체 남은 상품 수
// - 설문 참여 마감 여부(참여자 수가 전체 상품 수(MAX_PARTICIPANTS)에 도달했는지)
// - 추첨 마감 여부(전체 남은 상품이 0인지)
export async function GET() {
  const supabase = getSupabaseServiceClient();

  const [{ data: prizes, error: prizesError }, { count, error: countError }] = await Promise.all([
    supabase
      .from("prizes")
      .select("id, rank, name, initial_quantity, remaining_quantity, display_order")
      .order("display_order", { ascending: true }),
    supabase.from("participants").select("id", { count: "exact", head: true }).eq("is_test", false),
  ]);

  if (prizesError || countError) {
    console.error(prizesError || countError);
    return NextResponse.json({ error: "UNKNOWN" }, { status: 500 });
  }

  const totalRemaining = (prizes ?? []).reduce((sum, p) => sum + p.remaining_quantity, 0);
  const participantCount = count ?? 0;

  return NextResponse.json({
    prizes: prizes ?? [],
    totalRemaining,
    participantCount,
    maxParticipants: MAX_PARTICIPANTS,
    surveyClosed: participantCount >= MAX_PARTICIPANTS,
    drawClosed: totalRemaining <= 0,
  });
}
