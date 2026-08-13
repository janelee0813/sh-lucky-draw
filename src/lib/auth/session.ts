import "server-only";
import crypto from "crypto";

// 간단한 HMAC 서명 세션 토큰.
// 별도 회원가입/DB 세션 테이블 없이, 비밀번호를 서버에서 검증한 뒤
// "role|expiry|signature" 형태의 서명된 쿠키 값을 발급한다.
// 프론트엔드 JS는 비밀번호를 절대 비교하지 않는다 (요청사항 42번).

export type SessionRole = "admin" | "staff";

function getSecret() {
  const secret = process.env.SESSION_SECRET;
  if (!secret) {
    throw new Error("SESSION_SECRET 환경변수가 설정되지 않았습니다.");
  }
  return secret;
}

function sign(payload: string) {
  return crypto.createHmac("sha256", getSecret()).update(payload).digest("hex");
}

export function createSessionToken(role: SessionRole, ttlSeconds: number) {
  const expiry = Date.now() + ttlSeconds * 1000;
  const payload = `${role}|${expiry}`;
  const signature = sign(payload);
  return `${payload}|${signature}`;
}

export function verifySessionToken(token: string | undefined | null, requiredRole: SessionRole): boolean {
  if (!token) return false;
  const parts = token.split("|");
  if (parts.length !== 3) return false;
  const [role, expiryStr, signature] = parts;
  const payload = `${role}|${expiryStr}`;
  const expected = sign(payload);

  // Timing-safe 비교
  const sigBuf = Buffer.from(signature);
  const expBuf = Buffer.from(expected);
  if (sigBuf.length !== expBuf.length) return false;
  if (!crypto.timingSafeEqual(sigBuf, expBuf)) return false;

  if (role !== requiredRole && !(requiredRole === "staff" && role === "admin")) {
    // admin 세션은 staff 권한도 겸용으로 인정 (관리자가 TV Draw도 조작 가능)
    return false;
  }

  const expiry = Number(expiryStr);
  if (Number.isNaN(expiry) || Date.now() > expiry) return false;

  return true;
}

export const ADMIN_COOKIE = "sh_admin_session";
export const STAFF_COOKIE = "sh_staff_session";

export const ADMIN_SESSION_TTL_SECONDS = 60 * 60 * 8; // 8시간
export const STAFF_SESSION_TTL_SECONDS = 60 * 60 * 16; // 16시간 (행사 하루 종일 유지)
