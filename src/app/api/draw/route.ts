import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getSupabaseServiceClient } from "@/lib/supabase/server";
import { requireStaffResponse } from "@/lib/auth/guard";
import { parseTicketNumber } from "@/lib/utils/ticket-number";

const bodySchema = z.object({
  ticketNumber: z.string().min(1).max(4),
});

// 이 API는 TV 화면에서만 호출된다. Staff/Admin 세션 쿠키가 없으면 차단한다.
// 실제 당첨 결과는 이 안에서(=서버) draw_prize RPC(Postgres Transaction)로만 결정되며,
// 프론트엔드 애니메이션은 이 응답을 기다리는 동안의 연출일 뿐이다.
export async function POST(req: NextRequest) {
  const unauthorized = requireStaffResponse();
  if (unauthorized) return unauthorized;

  let body: z.infer<typeof bodySchema>;
  try {
    const json = await req.json();
    body = bodySchema.parse(json);
  } catch {
    return NextResponse.json({ error: "INVALID_INPUT" }, { status: 400 });
  }

  const ticketNumber = parseTicketNumber(body.ticketNumber);
  if (ticketNumber === null) {
    return NextResponse.json(
      { error: "NOT_FOUND", message: "등록되지 않은 응모번호입니다." },
      { status: 404 }
    );
  }

  const supabase = getSupabaseServiceClient();
  const { data, error } = await supabase.rpc("draw_prize", { p_ticket_number: ticketNumber });

  if (error) {
    const message = error.message || "";

    if (message.includes("NOT_FOUND")) {
      return NextResponse.json(
        { error: "NOT_FOUND", message: "등록되지 않은 응모번호입니다." },
        { status: 404 }
      );
    }
    if (message.includes("SOLD_OUT")) {
      return NextResponse.json(
        { error: "SOLD_OUT", message: "모든 상품이 소진되어 더 이상 추첨할 수 없습니다." },
        { status: 409 }
      );
    }

    console.error("draw_prize error:", error);
    return NextResponse.json({ error: "UNKNOWN", message: "일시적인 오류가 발생했습니다." }, { status: 500 });
  }

  const row = Array.isArray(data) ? data[0] : data;

  return NextResponse.json({
    alreadyDrawn: row.already_drawn,
    prizeRank: row.prize_rank,
    prizeName: row.prize_name,
  });
}
