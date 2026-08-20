export function formatTicketNumber(n: number): string {
  return String(n).padStart(4, "0");
}

export function parseTicketNumber(s: string): number | null {
  const trimmed = s.trim();
  if (!/^\d{1,4}$/.test(trimmed)) return null;
  const n = Number(trimmed);
  if (Number.isNaN(n) || n <= 0) return null;
  return n;
}

export function isValidPhone(phone: string): boolean {
  // 010-1234-5678 또는 01012345678 형태 허용
  return /^01[0-9]-?\d{3,4}-?\d{4}$/.test(phone.trim());
}

export function normalizePhone(phone: string): string {
  const digits = phone.replace(/[^0-9]/g, "");
  if (digits.length === 11) {
    return `${digits.slice(0, 3)}-${digits.slice(3, 7)}-${digits.slice(7)}`;
  }
  if (digits.length === 10) {
    return `${digits.slice(0, 3)}-${digits.slice(3, 6)}-${digits.slice(6)}`;
  }
  return phone.trim();
}

export function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
}

// 개인 메일 도메인 차단 목록 - 기업용(업무용) 이메일만 접수하기 위함
export const BLOCKED_EMAIL_DOMAINS = ["naver.com", "daum.net", "hanmail.net", "google.com"];

export function isBlockedEmailDomain(email: string): boolean {
  const domain = email.trim().toLowerCase().split("@")[1] ?? "";
  return BLOCKED_EMAIL_DOMAINS.includes(domain);
}
