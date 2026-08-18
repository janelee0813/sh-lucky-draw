import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServiceClient } from "@/lib/supabase/server";
import { requireAdminResponse } from "@/lib/auth/guard";

// body: { scope: "prizes_only" | "full", confirmText: string }
// confirmText가 정확히 "RESET" 이어야만 실행한다. (요청사항 51)
export async function POST(req: NextRequest) {
  const unauthorized = requireAdminResponse();
  if (unauthorized) return unauthorized;

  const body = await req.json().catch(() => null);
  const scope = body?.scope;
  const confirmText = body?.confirmText;

  if (scope !== "prizes_only" && scope !== "full") {
    return NextResponse.json({ error: "INVALID_SCOPE" }, { status: 400 });
  }
  if (confirmText !== "RESET") {
    return NextResponse.json({ error: "CONFIRM_TEXT_MISMATCH" }, { status: 400 });
  }

  const supabase = getSupabaseServiceClient();
  const { error } = await supabase.rpc("admin_reset_event", { p_scope: scope });

  if (error) {
    console.error("reset error:", error);
    return NextResponse.json({ error: "UNKNOWN", message: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
