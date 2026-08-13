// 이벤트 전역 설정
// 상품 수량이 바뀌면 이 파일과 supabase/seed.sql 두 곳을 함께 수정한다.

export interface PrizeSeed {
  rank: 1 | 2 | 3 | 4 | 5;
  name: string;
  initial_quantity: number;
  display_order: number;
}

export const PRIZE_SEED: PrizeSeed[] = [
  { rank: 1, name: "AirPods 4", initial_quantity: 1, display_order: 1 },
  { rank: 2, name: "Belkin 충전기", initial_quantity: 5, display_order: 2 },
  { rank: 3, name: "Re:QM 여행용 충전기", initial_quantity: 10, display_order: 3 },
  { rank: 4, name: "편의점 상품권", initial_quantity: 100, display_order: 4 },
  // 5등 수량 100 -> 84로 조정 (총합 200개에 맞춤: 1+5+10+100+84=200)
  { rank: 5, name: "Haribo 젤리 간식", initial_quantity: 84, display_order: 5 },
];

export const TOTAL_INITIAL_PRIZES = PRIZE_SEED.reduce((sum, p) => sum + p.initial_quantity, 0); // 200

// 설문 참여는 "꽝 없는" 이벤트이므로, 전체 상품 수량(TOTAL_INITIAL_PRIZES)만큼
// 참여자가 모이면 더 이상 설문을 받지 않는다. (참여자 수가 상품 수를 넘지 않도록 보장)
export const MAX_PARTICIPANTS = TOTAL_INITIAL_PRIZES;

// TV 화면에 실제 재고와 무관하게 항상 시각적으로 표시할 Ball 개수 (4~5등)
export const VISUAL_BALL_COUNT: Record<4 | 5, number> = {
  4: 20,
  5: 25,
};

// Ball 상대 크기(px)
export const BALL_SIZE: Record<1 | 2 | 3 | 4 | 5, number> = {
  1: 140,
  2: 110,
  3: 90,
  4: 60,
  5: 45,
};

// 중복 참여(동일 휴대전화) 기본 정책 - Admin Settings에서 event_settings.allow_duplicate_phone 으로 override 가능
export const DEFAULT_ALLOW_DUPLICATE_PHONE = false;

export const EVENT_NAME = "SH AI EXPO 2026 LUCKY DRAW";
export const ORG_NAME_EN = "SEOUL HOUSING & COMMUNITIES CORPORATION";
