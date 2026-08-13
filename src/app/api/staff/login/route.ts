import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { createSessionToken, STAFF_COOKIE, STAFF_SESSION_TTL_SECONDS } from "@/lib/auth/session";

// 현장 운영자가 TV 화면에서 1회 입력하면 행사 동안(16시간) 계속 사용 가능하다.
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const password = typeof body?.password === "string" ? body.password : "";

  const expected = process.env.STAFF_PASSWORD || "";
  const provided = Buffer.from(password);
  const expectedBuf = Buffer.from(expected);

  const isMatch =
    provided.length === expectedBuf.length &&
    expected.length > 0 &&
    crypto.timingSafeEqual(provided, expectedBuf);

  if (!isMatch) {
    return NextResponse.json({ error: "INVALID_PASSWORD" }, { status: 401 });
  }

  const token = createSessionToken("staff", STAFF_SESSION_TTL_SECONDS);
  const res = NextResponse.json({ ok: true });
  res.cookies.set(STAFF_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: STAFF_SESSION_TTL_SECONDS,
  });
  return res;
}
