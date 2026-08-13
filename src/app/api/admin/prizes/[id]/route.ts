import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServiceClient } from "@/lib/supabase/server";
import { requireAdminResponse } from "@/lib/auth/guard";

// 초기수량(initial_quantity)을 변경한다.
// 이미 당첨 처리된 수량(won = initial - remaining)보다 적게 설정하면 오류를 반환한다. (요청사항 50)
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const unauthorized = requireAdminResponse();
  if (unauthorized) return unauthorized;

  const body = await req.json().catch(() => null);
  const newInitialQuantity = Number(body?.initial_quantity);
  if (!Number.isFinite(newInitialQuantity) || newInitialQuantity < 0) {
    return NextResponse.json({ error: "INVALID_INPUT" }, { status: 400 });
  }

  const supabase = getSupabaseServiceClient();
  const { data: prize, error: fetchError } = await supabase
    .from("prizes")
    .select("id, initial_quantity, remaining_quantity")
    .eq("id", params.id)
    .maybeSingle();

  if (fetchError || !prize) {
    return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
  }

  const wonQuantity = prize.initial_quantity - prize.remaining_quantity;
  if (newInitialQuantity < wonQuantity) {
    return NextResponse.json(
      {
        error: "BELOW_WON_QUANTITY",
        message: `이미 ${wonQuantity}개가 당첨 처리되어, 초기수량을 그보다 적게 설정할 수 없습니다.`,
      },
      { status: 400 }
    );
  }

  const newRemaining = newInitialQuantity - wonQuantity;

  const { error: updateError } = await supabase
    .from("prizes")
    .update({
      initial_quantity: newInitialQuantity,
      remaining_quantity: newRemaining,
      updated_at: new Date().toISOString(),
    })
    .eq("id", params.id);

  if (updateError) {
    console.error(updateError);
    return NextResponse.json({ error: "UNKNOWN" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
