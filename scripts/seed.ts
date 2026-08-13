// npm run seed
// supabase/migrations/0001_init.sql 을 먼저 Supabase에 적용한 뒤 실행한다.
// 상품 Seed Data를 삽입/갱신한다. (참가자 데이터는 건드리지 않는다)

import "dotenv/config";
import { createClient } from "@supabase/supabase-js";
import { PRIZE_SEED } from "../src/lib/config/settings";

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceKey) {
    console.error(
      "NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY 환경변수가 필요합니다. .env.local을 확인하세요."
    );
    process.exit(1);
  }

  const supabase = createClient(url, serviceKey);

  console.log("상품 Seed Data 삽입 중...");

  for (const prize of PRIZE_SEED) {
    const { data: existing, error: selectError } = await supabase
      .from("prizes")
      .select("id, remaining_quantity, initial_quantity")
      .eq("rank", prize.rank)
      .maybeSingle();

    if (selectError) {
      console.error(`rank ${prize.rank} 조회 실패:`, selectError.message);
      process.exit(1);
    }

    if (!existing) {
      const { error } = await supabase.from("prizes").insert({
        rank: prize.rank,
        name: prize.name,
        initial_quantity: prize.initial_quantity,
        remaining_quantity: prize.initial_quantity,
        display_order: prize.display_order,
      });
      if (error) {
        console.error(`rank ${prize.rank} 삽입 실패:`, error.message);
        process.exit(1);
      }
      console.log(`  [생성] ${prize.rank}등 ${prize.name} x${prize.initial_quantity}`);
    } else {
      const { error } = await supabase
        .from("prizes")
        .update({
          name: prize.name,
          initial_quantity: prize.initial_quantity,
          display_order: prize.display_order,
        })
        .eq("rank", prize.rank);
      if (error) {
        console.error(`rank ${prize.rank} 갱신 실패:`, error.message);
        process.exit(1);
      }
      console.log(
        `  [확인] ${prize.rank}등 ${prize.name} (기존 remaining_quantity=${existing.remaining_quantity} 유지)`
      );
    }
  }

  const total = PRIZE_SEED.reduce((sum, p) => sum + p.initial_quantity, 0);
  console.log(`완료. 총 상품 수량: ${total}개`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
