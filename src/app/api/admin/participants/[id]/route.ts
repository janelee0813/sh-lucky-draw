import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServiceClient } from "@/lib/supabase/server";
import { requireAdminResponse } from "@/lib/auth/guard";

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const unauthorized = requireAdminResponse();
  if (unauthorized) return unauthorized;

  const body = await req.json().catch(() => null);
  if (typeof body?.received !== "boolean") {
    return NextResponse.json({ error: "INVALID_INPUT" }, { status: 400 });
  }

  const supabase = getSupabaseServiceClient();
  const { error } = await supabase
    .from("participants")
    .update({
      received: body.received,
      received_at: body.received ? new Date().toISOString() : null,
    })
    .eq("id", params.id);

  if (error) {
    console.error("update received error:", error);
    return NextResponse.json({ error: "UNKNOWN" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
