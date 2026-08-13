"use client";

import { createClient } from "@supabase/supabase-js";

// 브라우저에서 사용하는 클라이언트. anon key만 사용하며,
// RLS(Row Level Security) 정책으로 public 데이터만 접근 가능하다.
// participants 테이블의 개인정보(name/phone/email)는 RLS로 차단되어 있어
// 이 클라이언트로는 절대 조회되지 않는다. (supabase/migrations/0001_init.sql 참고)
let browserClient: ReturnType<typeof createClient<any, "public", any>> | null = null;

export function getSupabaseBrowserClient() {
  if (browserClient) return browserClient;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    throw new Error(
      "Supabase 환경변수가 설정되지 않았습니다. .env.local의 NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY를 확인하세요."
    );
  }

  browserClient = createClient<any, "public", any>(url, anonKey, {
    auth: { persistSession: false },
  });
  return browserClient;
}
