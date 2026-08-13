import { NextResponse } from "next/server";
import { getSupabaseServiceClient } from "@/lib/supabase/server";
import { requireAdminResponse } from "@/lib/auth/guard";

export const dynamic = "force-dynamic";

export async function GET() {
  const unauthorized = requireAdminResponse();
  if (unauthorized) return unauthorized;

  const supabase = getSupabaseServiceClient();

  const [
    { count: totalParticipants },
    { count: drawnCount },
    { data: prizes },
  ] = await Promise.all([
    supabase.from("participants").select("id", { count: "exact", head: true }),
    supabase.from("participants").select("id", { count: "exact", head: true }).not("drawn_at", "is", null),
    supabase.from("prizes").select("remaining_quantity"),
  ]);

  const total = totalParticipants ?? 0;
  const drawn = drawnCount ?? 0;
  const remaining = (prizes ?? []).reduce((sum, p) => sum + p.remaining_quantity, 0);

  return NextResponse.json({
    totalParticipants: total,
    drawnCount: drawn,
    pendingDrawCount: total - drawn,
    remainingPrizes: remaining,
  });
}
