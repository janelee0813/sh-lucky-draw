// 설문 문항 설정
// 실제 문항이 확정되면 이 파일만 수정하면 된다. (코드 로직 변경 불필요)

export interface SurveyOption {
  value: string;
  label: string;
}

// option value(slug) -> label 변환 (관리자 화면/엑셀 다운로드에서 사용)
export function optionLabel(options: SurveyOption[], value: string | null | undefined): string {
  if (!value) return "";
  return options.find((o) => o.value === value)?.label ?? value;
}

export interface SurveyQuestion {
  key: "survey_answer_1" | "survey_answer_2";
  notice?: string;
  title: string;
  options: SurveyOption[];
}

const MAGOK_NOTICE =
  "마곡일반산업단지 내 복합용지는 본사 사옥, R&D 연구소(산업시설 50%)과 근린생활, 업무, 의료시설(지원시설 50%) 등으로 입체적 복합개발이 가능한 토지입니다";

export const SURVEY_QUESTIONS: SurveyQuestion[] = [
  {
    key: "survey_answer_1",
    notice: MAGOK_NOTICE,
    title: "마곡 일반산업단지 내 관심 있는\n블록이나 필지를 선택해 주세요.",
    options: [
      { value: "anchor_block", label: "5호선 발산역 인접 대형 앵커 블록(L4, L5, L6)" },
      { value: "small_lot_balsan", label: "5호선 발산역 인접 중소형 분할 필지(L5-3,4,5,6, L7)" },
      { value: "small_lot_olympic", label: "올림픽대로 인접 중소형 분할 필지(L1-1,2,3, L2-1,2,3, L3-1,2,3)" },
    ],
  },
  {
    key: "survey_answer_2",
    notice: MAGOK_NOTICE,
    title: "가장 중요한 입주 결정 요소를\n선택해 주세요.",
    options: [
      { value: "transport", label: "대중교통 및 접근성" },
      { value: "price", label: "공급단가 및 분양가" },
      { value: "cluster", label: "주변 AI, IT 기업과의 집적도" },
      { value: "infra", label: "시설 인프라" },
    ],
  },
];

// ---- 참여자 정보: 이름 / 연락처 / 이메일 (텍스트 입력) ----
export interface ParticipantFieldConfig {
  key: "name" | "phone" | "email";
  label: string;
  placeholder: string;
  required: boolean;
  type: "text" | "tel" | "email";
}

export const PARTICIPANT_FIELDS: ParticipantFieldConfig[] = [
  { key: "name", label: "성함", placeholder: "홍길동", required: true, type: "text" },
  { key: "phone", label: "연락처", placeholder: "010-0000-0000", required: true, type: "tel" },
  { key: "email", label: "이메일", placeholder: "example@email.com", required: true, type: "email" },
];

// ---- 참여자 정보: 기업명 + 직무 분야 ----
export const JOB_ROLE_OPTIONS: SurveyOption[] = [
  { value: "dev_engineer", label: "개발/엔지니어" },
  { value: "planning_marketing", label: "기획/마케팅" },
  { value: "management_hr", label: "경영지원/인사" },
  { value: "rnd", label: "연구개발(R&D)" },
  { value: "etc", label: "기타" },
];

// ---- 참여자 정보: 기업부설연구소 / R&D 전담 부서 보유 여부 ----
export const RND_DEPT_OPTIONS: SurveyOption[] = [
  { value: "has", label: "보유하고 있음" },
  { value: "none", label: "보유하고 있지 않음" },
  { value: "unknown", label: "잘 모름 / 확인 필요" },
];

// RND_DEPT_OPTIONS 중 "보유하고 있음" 선택 시에만 노출되는 후속 질문
export const RND_RELOCATION_OPTIONS: SurveyOption[] = [
  { value: "yes", label: "예" },
  { value: "no", label: "아니오" },
  { value: "unknown", label: "잘 모름/확인필요" },
];

// ---- 참여자 정보: 본사 / 연구실 위치 ----
export const HQ_LOCATION_OPTIONS: SurveyOption[] = [
  { value: "gangnam_jamsil", label: "서울 강남/잠실권" },
  { value: "yeouido_yeongdeungpo", label: "서울 여의도/영등포권" },
  { value: "pangyo_bundang_gyeonggi", label: "서울 판교/분당/경기권" },
  { value: "etc", label: "기타 지역" },
];
// HQ_LOCATION_OPTIONS 중 이 값을 선택하면 자유 입력 텍스트 필드가 함께 노출된다.
export const HQ_LOCATION_OTHER_VALUE = "etc";

// ---- 개인정보 동의 문구 ----
// 실제 행사 정책이 확정되면 이 문구만 교체하면 된다.
export const PRIVACY_CONSENT_TEXT = {
  title: "개인정보 수집 및 이용 동의",
  body: `1. 수집 항목: 성함, 연락처, 이메일, 소속 기업명 및 직무, R&D 부서 현황, 본사/연구실 위치, 설문 응답
2. 수집 목적: AI Summit Seoul & Expo SH서울주택도시개발공사 부스 Lucky Draw 이벤트 참여 및 경품 지급
3. 보유 및 이용 기간: 이벤트 종료 후 90일간 보관 후 파기
4. 동의를 거부할 권리가 있으며, 미동의 시 이벤트 참여가 제한됩니다.`,
  checkboxLabel: "개인정보 수집 및 이용에 동의합니다.",
};
