import { NextResponse } from "next/server";
import { getSupabaseServiceClient } from "@/lib/supabase/server";
import { requireAdminResponse } from "@/lib/auth/guard";

export const dynamic = "force-dynamic";

export async function GET() {
  const unauthorized = requireAdminResponse();
  if (unauthorized) return unauthorized;

  const supabase = getSupabaseServiceClient();
  const { data: prizes, error } = await supabase
    .from("prizes")
    .select("id, rank, name, initial_quantity, remaining_quantity, display_order")
    .order("display_order", { ascending: true });

  if (error) {
    console.error(error);
    return NextResponse.json({ error: "UNKNOWN" }, { status: 500 });
  }

  // 상품별 당첨 수 = initial_quantity - remaining_quantity
  const withWon = (prizes ?? []).map((p) => ({
    ...p,
    won_quantity: p.initial_quantity - p.remaining_quantity,
  }));

  return NextResponse.json({ prizes: withWon });
}
