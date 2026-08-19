import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getSupabaseServiceClient } from "@/lib/supabase/server";
import { requireAdminResponse } from "@/lib/auth/guard";

const prizeSchema = z.object({
  rank: z.number().int().min(1).max(5),
  name: z.string().trim().min(1),
  initial_quantity: z.number().int().min(0),
  display_order: z.number().int(),
});

const bodySchema = z.object({
  prizes: z.array(prizeSchema).min(1),
  confirmText: z.string(),
});

// 현재 라운드 데이터를 보관 테이블로 옮기고, 새 라운드 상품 구성으로 라이브 테이블을 초기화한다.
// confirmText가 정확히 "START"여야만 실행한다. (ResetPanel의 "RESET" 확인 패턴과 동일)
export async function POST(req: NextRequest) {
  const unauthorized = requireAdminResponse();
  if (unauthorized) return unauthorized;

  let body: z.infer<typeof bodySchema>;
  try {
    const json = await req.json();
    body = bodySchema.parse(json);
  } catch {
    return NextResponse.json({ error: "INVALID_INPUT" }, { status: 400 });
  }

  if (body.confirmText !== "START") {
    return NextResponse.json({ error: "CONFIRM_TEXT_MISMATCH" }, { status: 400 });
  }

  const supabase = getSupabaseServiceClient();
  const { data, error } = await supabase.rpc("admin_start_new_round", { p_prizes: body.prizes });

  if (error) {
    console.error("start new round error:", error);
    return NextResponse.json({ error: "UNKNOWN", message: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, newRound: data });
}
