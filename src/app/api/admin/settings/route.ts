import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServiceClient } from "@/lib/supabase/server";
import { requireAdminResponse } from "@/lib/auth/guard";

export const dynamic = "force-dynamic";

export async function GET() {
  const unauthorized = requireAdminResponse();
  if (unauthorized) return unauthorized;

  const supabase = getSupabaseServiceClient();
  const { data, error } = await supabase.from("event_settings").select("*").eq("id", 1).maybeSingle();

  if (error) {
    console.error(error);
    return NextResponse.json({ error: "UNKNOWN" }, { status: 500 });
  }

  return NextResponse.json({ settings: data });
}

export async function PUT(req: NextRequest) {
  const unauthorized = requireAdminResponse();
  if (unauthorized) return unauthorized;

  const body = await req.json().catch(() => null);
  const update: Record<string, boolean | number | null> = {};
  if (typeof body?.allow_duplicate_phone === "boolean") {
    update.allow_duplicate_phone = body.allow_duplicate_phone;
  }
  if (typeof body?.test_mode === "boolean") {
    update.test_mode = body.test_mode;
  }
  if ("rank1_fixed_draw_number" in (body ?? {})) {
    const value = body.rank1_fixed_draw_number;
    if (value === null) {
      update.rank1_fixed_draw_number = null;
    } else if (Number.isInteger(value) && value > 0) {
      update.rank1_fixed_draw_number = value;
    } else {
      return NextResponse.json({ error: "INVALID_INPUT" }, { status: 400 });
    }
  }

  const supabase = getSupabaseServiceClient();
  const { error } = await supabase
    .from("event_settings")
    .update({ ...update, updated_at: new Date().toISOString() })
    .eq("id", 1);

  if (error) {
    console.error(error);
    return NextResponse.json({ error: "UNKNOWN" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
