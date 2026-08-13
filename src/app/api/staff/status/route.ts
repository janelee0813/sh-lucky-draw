import { NextResponse } from "next/server";
import { isStaffAuthed } from "@/lib/auth/guard";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json({ authed: isStaffAuthed() });
}
