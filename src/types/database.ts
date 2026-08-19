// SH AI EXPO Lucky Draw - Database 타입 정의
// supabase/migrations/0001_init.sql 스키마와 1:1로 대응한다.

export type PrizeRank = 1 | 2 | 3 | 4 | 5;

export interface Prize {
  id: string;
  rank: PrizeRank;
  name: string;
  initial_quantity: number;
  remaining_quantity: number;
  display_order: number;
  created_at: string;
  updated_at: string;
}

export interface Participant {
  id: string;
  ticket_number: number; // 내부 저장은 숫자, 화면 표시는 0001 형태로 padStart
  name: string;
  company: string | null;
  job_role: string | null;
  rnd_dept: string | null;
  rnd_dept_name: string | null;
  rnd_relocation_plan: string | null;
  hq_location: string | null;
  hq_location_other: string | null;
  phone: string;
  email: string;
  survey_answer_1: string;
  survey_answer_2: string;
  privacy_consent: boolean;
  created_at: string;
  drawn_at: string | null;
  prize_id: string | null;
  received: boolean;
  received_at: string | null;
}

export interface Companion {
  id: string;
  participant_id: string;
  name: string;
  team: string | null;
  position: string | null;
  phone: string;
  created_at: string;
}

export interface DrawLog {
  id: string;
  participant_id: string;
  ticket_number: number;
  prize_id: string;
  prize_rank: PrizeRank;
  drawn_at: string;
}

export interface EventSettings {
  id: number;
  allow_duplicate_phone: boolean;
  test_mode: boolean;
  updated_at: string;
}

// ---- 공개(public)용 축소 타입 - 개인정보 제외 ----
export interface PublicPrizeStatus {
  id: string;
  rank: PrizeRank;
  name: string;
  remaining_quantity: number;
  initial_quantity: number;
  display_order: number;
}

export interface PublicTicketInfo {
  ticket_number: string; // "0027"
  drawn: boolean;
  prize_rank: PrizeRank | null;
  prize_name: string | null;
}

// ---- Draw API 응답 ----
export type DrawResult =
  | { status: "success"; alreadyDrawn: false; prizeRank: PrizeRank; prizeName: string }
  | { status: "success"; alreadyDrawn: true; prizeRank: PrizeRank; prizeName: string }
  | { status: "error"; reason: "NOT_FOUND" | "SOLD_OUT" | "UNAUTHORIZED" | "UNKNOWN" };
