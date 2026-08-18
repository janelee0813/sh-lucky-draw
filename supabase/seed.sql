-- SH AI EXPO 2026 LUCKY DRAW - 상품 Seed Data
-- 총 200개 (1등 1 + 2등 5 + 3등 10 + 4등 100 + 5등 84)
-- Supabase Dashboard > SQL Editor 에서 0001_init.sql 실행 이후 실행한다.
-- 이미 데이터가 있으면 아무 것도 하지 않는다 (rank UNIQUE 기준 upsert).

insert into prizes (rank, name, initial_quantity, remaining_quantity, display_order)
values
  (1, 'AirPods 4', 1, 1, 1),
  (2, 'Belkin 충전기', 5, 5, 2),
  (3, 'Re:QM 여행용 충전기', 10, 10, 3),
  (4, '편의점 상품권 3,000원', 100, 100, 4),
  (5, 'Haribo 젤리 간식', 84, 84, 5)
on conflict (rank) do update set
  name = excluded.name,
  initial_quantity = excluded.initial_quantity,
  display_order = excluded.display_order;
-- 주의: 이미 진행 중인 이벤트에서 이 스크립트를 재실행해도 remaining_quantity는
-- 덮어쓰지 않는다 (재고 초기화는 /admin 의 "이벤트 데이터 초기화" 기능을 사용할 것).
