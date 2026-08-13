// 설문 문항 설정
// 실제 문항이 확정되면 이 파일만 수정하면 된다. (코드 로직 변경 불필요)

export interface SurveyOption {
  value: string;
  label: string;
}

export interface SurveyQuestion {
  key: "survey_answer_1" | "survey_answer_2";
  title: string;
  options: SurveyOption[];
}

export const SURVEY_QUESTIONS: SurveyQuestion[] = [
  {
    key: "survey_answer_1",
    title: "SH서울주택도시개발공사에 대해\n어느 정도 알고 계셨나요?",
    options: [
      { value: "well", label: "잘 알고 있었다" },
      { value: "some", label: "어느 정도 알고 있었다" },
      { value: "name_only", label: "이름만 알고 있었다" },
      { value: "not_much", label: "잘 몰랐다" },
    ],
  },
  {
    key: "survey_answer_2",
    title: "SH에 대해 가장 관심 있는\n정보는 무엇인가요?",
    options: [
      { value: "housing", label: "주택·청약" },
      { value: "urban_dev", label: "도시개발" },
      { value: "biz_space", label: "기업·산업 공간" },
      { value: "smart_city", label: "스마트시티" },
      { value: "etc", label: "기타" },
    ],
  },
];

// ---- 참여자 정보 입력 필드 설정 ----
export interface ParticipantFieldConfig {
  key: "name" | "company" | "phone" | "email";
  label: string;
  placeholder: string;
  required: boolean;
  type: "text" | "tel" | "email";
}

export const PARTICIPANT_FIELDS: ParticipantFieldConfig[] = [
  { key: "name", label: "이름", placeholder: "홍길동", required: true, type: "text" },
  { key: "company", label: "회사 / 소속", placeholder: "선택 입력", required: false, type: "text" },
  { key: "phone", label: "휴대전화", placeholder: "010-0000-0000", required: true, type: "tel" },
  { key: "email", label: "이메일", placeholder: "example@email.com", required: true, type: "email" },
];

// ---- 개인정보 동의 문구 ----
// 실제 행사 정책이 확정되면 이 문구만 교체하면 된다.
export const PRIVACY_CONSENT_TEXT = {
  title: "개인정보 수집 및 이용 동의",
  body: `1. 수집 항목: 이름, 회사/소속, 휴대전화, 이메일, 설문 응답
2. 수집 목적: AI EXPO 2026 SH서울주택도시개발공사 부스 Lucky Draw 이벤트 참여 및 경품 지급
3. 보유 및 이용 기간: 이벤트 종료 후 90일간 보관 후 파기
4. 동의를 거부할 권리가 있으며, 미동의 시 이벤트 참여가 제한됩니다.`,
  checkboxLabel: "개인정보 수집 및 이용에 동의합니다.",
};
