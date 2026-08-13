import "server-only";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { ADMIN_COOKIE, STAFF_COOKIE, verifySessionToken } from "./session";

export function isAdminAuthed(): boolean {
  const token = cookies().get(ADMIN_COOKIE)?.value;
  return verifySessionToken(token, "admin");
}

export function isStaffAuthed(): boolean {
  const staffToken = cookies().get(STAFF_COOKIE)?.value;
  if (verifySessionToken(staffToken, "staff")) return true;
  // 관리자 세션이 있으면 TV Draw 권한도 함께 인정한다.
  const adminToken = cookies().get(ADMIN_COOKIE)?.value;
  return verifySessionToken(adminToken, "admin");
}

export function requireAdminResponse(): NextResponse | null {
  if (!isAdminAuthed()) {
    return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  }
  return null;
}

export function requireStaffResponse(): NextResponse | null {
  if (!isStaffAuthed()) {
    return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  }
  return null;
}
