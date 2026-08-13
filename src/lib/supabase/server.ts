import "server-only";
import { createClient } from "@supabase/supabase-js";

// Service Role Key를 사용하는 서버 전용 클라이언트.
// 절대 client component나 브라우저로 이 파일을 import하지 않는다.
// (import "server-only" 가 있어 실수로 클라이언트에서 import 시 빌드 에러 발생)
// Database 제네릭 타입을 생성하지 않았으므로(supabase gen types 미사용),
// any로 두어 postgrest-js의 과도하게 엄격한 update/insert 타입 추론(never)을 피한다.
let serverClient: ReturnType<typeof createClient<any, "public", any>> | null = null;

export function getSupabaseServiceClient() {
  if (serverClient) return serverClient;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceKey) {
    throw new Error(
      "Supabase 서버 환경변수가 설정되지 않았습니다. .env.local의 SUPABASE_SERVICE_ROLE_KEY를 확인하세요."
    );
  }

  serverClient = createClient<any, "public", any>(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return serverClient;
}
