import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { ADMIN_COOKIE, ADMIN_SESSION_TTL_SECONDS, createSessionToken } from "@/lib/auth/session";

// 비밀번호는 프론트엔드에서 절대 비교하지 않는다. (요청사항 42)
// ADMIN_PASSWORD는 서버 환경변수로만 존재하며, 이 라우트에서 서버 사이드로만 검증한다.
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const password = typeof body?.password === "string" ? body.password : "";

  const expected = process.env.ADMIN_PASSWORD || "";
  const provided = Buffer.from(password);
  const expectedBuf = Buffer.from(expected);

  const isMatch =
    provided.length === expectedBuf.length &&
    expected.length > 0 &&
    crypto.timingSafeEqual(provided, expectedBuf);

  if (!isMatch) {
    return NextResponse.json({ error: "INVALID_PASSWORD" }, { status: 401 });
  }

  const token = createSessionToken("admin", ADMIN_SESSION_TTL_SECONDS);
  const res = NextResponse.json({ ok: true });
  res.cookies.set(ADMIN_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: ADMIN_SESSION_TTL_SECONDS,
  });
  return res;
}
