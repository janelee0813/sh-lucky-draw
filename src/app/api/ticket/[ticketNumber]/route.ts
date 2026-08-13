import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServiceClient } from "@/lib/supabase/server";
import { formatTicketNumber, parseTicketNumber } from "@/lib/utils/ticket-number";

export const dynamic = "force-dynamic";

// 개인정보(이름/전화/이메일)는 절대 포함하지 않는다.
// ticket_number, 추첨 여부, 당첨 상품명 정도만 반환한다. (요청사항 39, 66)
export async function GET(_req: NextRequest, { params }: { params: { ticketNumber: string } }) {
  const ticketNumber = parseTicketNumber(params.ticketNumber);
  if (ticketNumber === null) {
    return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
  }

  const supabase = getSupabaseServiceClient();
  const { data, error } = await supabase.rpc("get_public_ticket_status", {
    p_ticket_number: ticketNumber,
  });

  if (error) {
    if ((error.message || "").includes("NOT_FOUND")) {
      return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
    }
    console.error("get_public_ticket_status error:", error);
    return NextResponse.json({ error: "UNKNOWN" }, { status: 500 });
  }

  const row = Array.isArray(data) ? data[0] : data;

  return NextResponse.json({
    ticketNumber: formatTicketNumber(row.ticket_number),
    drawn: row.drawn,
    prizeRank: row.prize_rank,
    prizeName: row.prize_name,
  });
}
