// 설문 문항 설정
// 실제 문항이 확정되면 이 파일만 수정하면 된다. (코드 로직 변경 불필요)

export type Lang = "ko" | "en";

export interface SurveyOption {
  value: string;
  label: string;
  labelEn: string;
}

// option value(slug) -> label 변환 (관리자 화면/엑셀 다운로드에서 사용, 항상 한글)
export function optionLabel(options: SurveyOption[], value: string | null | undefined): string {
  if (!value) return "";
  return options.find((o) => o.value === value)?.label ?? value;
}

// 설문 화면에서 언어에 맞는 옵션 라벨 선택
export function optionLabelForLang(opt: SurveyOption, lang: Lang): string {
  return lang === "en" ? opt.labelEn : opt.label;
}

export interface SurveyQuestion {
  key: "survey_answer_1" | "survey_answer_2";
  notice?: string;
  noticeEn?: string;
  title: string;
  titleEn: string;
  options: SurveyOption[];
}

const MAGOK_NOTICE =
  "마곡일반산업단지 내 복합용지는 본사 사옥, R&D 연구소(산업시설 50%)과 근린생활, 업무, 의료시설(지원시설 50%) 등으로 입체적 복합개발이 가능한 토지입니다";
const MAGOK_NOTICE_EN =
  "The Magok General Industrial Complex Multi-Purpose Plot allows for multi-dimensional complex development. The space can be split 50/50: 50% for corporate headquarters and R&D centers (industrial facilities) and 50% for neighborhood amenities, offices, and medical clinics (support facilities).";

export const SURVEY_QUESTIONS: SurveyQuestion[] = [
  {
    key: "survey_answer_1",
    notice: MAGOK_NOTICE,
    noticeEn: MAGOK_NOTICE_EN,
    title: "마곡 일반산업단지 내 관심 있는\n부지(위치)가 있다면 선택해 주세요.",
    titleEn: "Please select your plot (location) of interest within the Magok General Industrial Complex:",
    options: [
      {
        value: "anchor_block",
        label: "① 5호선 발산역 대형 부지(L4, L5, L6)",
        labelEn: "① Large Plots near Balsan Station, Line 5 (L4, L5, L6)",
      },
      {
        value: "small_lot_balsan",
        label: "② 5호선 발산역 인접 중소형 부지(L5-3,4,5,6 / L7-1,2,3)",
        labelEn: "② Small & Medium Plots adjacent to Balsan Station, Line 5 (L5-3,4,5,6 / L7-1,2,3)",
      },
      {
        value: "small_lot_olympic",
        label: "③ 올림픽대로 인접 중소형 부지(L1-1,2,3, L2-1,2,3, L3-1,2,3)",
        labelEn: "③ Small & Medium Plots adjacent to Olympic Expressway (L1-1,2,3, L2-1,2,3, L3-1,2,3)",
      },
    ],
  },
  {
    key: "survey_answer_2",
    notice: MAGOK_NOTICE,
    noticeEn: MAGOK_NOTICE_EN,
    title: "가장 중요한 입주 결정 요소를\n선택해 주세요.",
    titleEn: "Please select the most critical factor in your decision to move in:",
    options: [
      { value: "transport", label: "대중교통 및 접근성", labelEn: "Public transport and accessibility" },
      { value: "price", label: "공급단가 및 분양가", labelEn: "Supply unit price and sales price" },
      { value: "cluster", label: "주변 AI, IT 기업과의 집적도", labelEn: "Proximity to neighboring AI and IT companies" },
      { value: "infra", label: "시설 인프라", labelEn: "Infrastructure and facilities" },
    ],
  },
];

// ---- 참여자 정보: 이름 / 연락처 / 이메일 (텍스트 입력) ----
export interface ParticipantFieldConfig {
  key: "name" | "phone" | "email";
  label: string;
  labelEn: string;
  placeholder: string;
  placeholderEn: string;
  required: boolean;
  type: "text" | "tel" | "email";
}

export const PARTICIPANT_FIELDS: ParticipantFieldConfig[] = [
  {
    key: "name",
    label: "성함",
    labelEn: "Name",
    placeholder: "홍길동",
    placeholderEn: "John Doe",
    required: true,
    type: "text",
  },
  {
    key: "phone",
    label: "연락처",
    labelEn: "Phone",
    placeholder: "010-0000-0000",
    placeholderEn: "010-0000-0000",
    required: true,
    type: "tel",
  },
  {
    key: "email",
    label: "이메일",
    labelEn: "Email",
    placeholder: "example@email.com",
    placeholderEn: "example@email.com",
    required: true,
    type: "email",
  },
];

// ---- 참여자 정보: 기업명 + 직무 분야 ----
export const JOB_ROLE_OPTIONS: SurveyOption[] = [
  { value: "dev_engineer", label: "개발/엔지니어", labelEn: "Development / Engineering" },
  { value: "planning_marketing", label: "기획/마케팅", labelEn: "Planning / Marketing" },
  { value: "management_hr", label: "경영지원/인사", labelEn: "Management Support / HR" },
  { value: "rnd", label: "연구개발(R&D)", labelEn: "R&D" },
  { value: "etc", label: "기타", labelEn: "Other" },
];

// ---- 참여자 정보: 기업부설연구소 / R&D 전담 부서 보유 여부 ----
export const RND_DEPT_OPTIONS: SurveyOption[] = [
  { value: "has", label: "보유하고 있음", labelEn: "Yes, we have one" },
  { value: "none", label: "보유하고 있지 않음", labelEn: "No, we don't" },
  { value: "unknown", label: "잘 모름 / 확인 필요", labelEn: "Not sure / need to check" },
];

// RND_DEPT_OPTIONS 중 "보유하고 있음" 선택 시에만 노출되는 후속 질문
export const RND_RELOCATION_OPTIONS: SurveyOption[] = [
  { value: "yes", label: "예", labelEn: "Yes" },
  { value: "no", label: "아니오", labelEn: "No" },
  { value: "unknown", label: "잘 모름/확인필요", labelEn: "Not sure / need to check" },
];

// ---- 참여자 정보: 본사 / 연구실 위치 ----
export const HQ_LOCATION_OPTIONS: SurveyOption[] = [
  { value: "gangnam_jamsil", label: "서울 강남/잠실권", labelEn: "Seoul – Gangnam / Jamsil area" },
  { value: "yeouido_yeongdeungpo", label: "서울 여의도/영등포권", labelEn: "Seoul – Yeouido / Yeongdeungpo area" },
  { value: "pangyo_bundang_gyeonggi", label: "서울 판교/분당/경기권", labelEn: "Pangyo / Bundang / Gyeonggi area" },
  { value: "etc", label: "기타 지역", labelEn: "Other region" },
];
// HQ_LOCATION_OPTIONS 중 이 값을 선택하면 자유 입력 텍스트 필드가 함께 노출된다.
export const HQ_LOCATION_OTHER_VALUE = "etc";

// ---- 개인정보 동의 문구 ----
// 실제 행사 정책이 확정되면 이 문구만 교체하면 된다.
export const PRIVACY_CONSENT_TEXT = {
  title: "개인정보 수집 및 이용 동의",
  titleEn: "Consent to Collection and Use of Personal Information",
  body: `1. 수집 항목: 성함, 연락처, 이메일, 소속 기업명 및 직무, R&D 부서 현황, 본사/연구실 위치, 설문 응답
2. 수집 목적: AI Summit Seoul & Expo SH서울주택도시개발공사 부스 Lucky Draw 이벤트 참여 및 경품 지급
3. 보유 및 이용 기간: 이벤트 종료 후 90일간 보관 후 파기
4. 동의를 거부할 권리가 있으며, 미동의 시 이벤트 참여가 제한됩니다.`,
  bodyEn: `1. Items collected: Name, phone number, email, company name and job role, R&D department status, HQ/lab location, survey responses
2. Purpose: Participation in the AI Summit Seoul & Expo SH Lucky Draw booth event and prize distribution
3. Retention period: Stored for 90 days after the event ends, then destroyed
4. You have the right to refuse consent; refusal will limit your ability to participate in the event.`,
  checkboxLabel: "개인정보 수집 및 이용에 동의합니다.",
  checkboxLabelEn: "I agree to the collection and use of my personal information.",
};

// ---- 설문 화면 UI 고정 문구 (설문 페이지 전용, 관리자/메인페이지에는 사용하지 않음) ----
export const SURVEY_UI_TEXT = {
  closedTitle: { ko: "참여가 마감되었습니다", en: "Participation Closed" },
  closedBody: {
    ko: "준비된 모든 응모권이 소진되어\n더 이상 설문 참여를 받고 있지 않습니다.\n방문해주셔서 감사합니다.",
    en: "All prepared entries have been\nclaimed, so we're no longer accepting\nsurvey responses. Thank you for visiting.",
  },
  introHeading: {
    ko: "설문에 참여하고\nLUCKY DRAW에 도전하세요.",
    en: "Take our survey and\nenter the LUCKY DRAW!",
  },
  introDesc: {
    ko: "간단한 설문을 완료하시면\n꽝 없는 이벤트 응모권을 드립니다.",
    en: "Complete a quick survey to win\na guaranteed prize.",
  },
  introButton: { ko: "설문 참여하기", en: "Take the Survey" },
  backAriaLabel: { ko: "이전 단계로", en: "Go back" },
  infoHeading: { ko: "참여자 정보를\n입력해주세요.", en: "Please enter your\nparticipant information." },
  infoSection1: {
    ko: "귀하의 성함과 연락처를 입력해 주세요.",
    en: "Please enter your name and contact information.",
  },
  infoSection2: {
    ko: "현재 소속되신 기업명과 본인의 업무(직무) 분야는 무엇인가요?",
    en: "What is your company name and job role?",
  },
  companyLabel: { ko: "기업명", en: "Company Name" },
  companyPlaceholder: { ko: "OO 주식회사", en: "e.g. ABC Corp." },
  jobRoleLabel: { ko: "직무", en: "Job Role" },
  infoSection3: {
    ko: "귀사(소속 기업)에 기업부설연구소 또는\n연구개발(R&D) 전담 부서가 있습니까?",
    en: "Does your company have an in-house\nresearch institute or dedicated R&D department?",
  },
  rndDeptNameLabel: { ko: "부서명 / 연구소명", en: "Department / Institute Name" },
  rndDeptNamePlaceholder: { ko: "예: OO기술연구소", en: "e.g. ABC Institute of Technology" },
  rndRelocationLabel: {
    ko: "해당 연구소(부서)의 이전 또는 확장 계획이 있습니까?",
    en: "Do you have plans to relocate or expand this department/institute?",
  },
  infoSection4: {
    ko: "귀사(소속 기업)의 본사/연구실 위치는 어디십니까?",
    en: "Where is your company's headquarters/research lab located?",
  },
  hqLocationOtherLabel: { ko: "지역 직접 입력", en: "Enter region" },
  hqLocationOtherPlaceholder: { ko: "예: 인천", en: "e.g. Incheon" },
  infoSection5: { ko: "함께 오신 동반자가 있습니까?", en: "Are you accompanied by anyone else?" },
  companionAddButton: { ko: "+ 동반자 추가", en: "+ Add companion" },
  companionRemoveButton: { ko: "삭제", en: "Remove" },
  companionTitle: { ko: "동반자", en: "Companion" },
  companionNameLabel: { ko: "이름", en: "Name" },
  companionNamePlaceholder: { ko: "홍길동", en: "John Doe" },
  companionTeamLabel: { ko: "팀", en: "Team" },
  companionTeamPlaceholder: { ko: "개발팀", en: "e.g. Engineering" },
  companionPositionLabel: { ko: "직책", en: "Position" },
  companionPositionPlaceholder: { ko: "과장", en: "e.g. Manager" },
  companionPhoneLabel: { ko: "연락처", en: "Phone" },
  companionPhonePlaceholder: { ko: "010-0000-0000", en: "010-0000-0000" },
  nextButton: { ko: "다음", en: "Next" },
  consentHeading: { ko: "마지막으로,\n약관에 동의해주세요.", en: "Finally,\nplease agree to the terms." },
  submitButton: { ko: "응모권 발급받기", en: "Get My Entry" },
  submittingButton: { ko: "응모권을 발급하고 있습니다...", en: "Issuing your entry..." },
  existingTicketButton: { ko: "기존 응모권 확인하기", en: "View my existing entry" },
  errorGeneric: { ko: "오류가 발생했습니다. 다시 시도해주세요.", en: "An error occurred. Please try again." },
  errorNetwork: {
    ko: "네트워크 오류가 발생했습니다. 다시 시도해주세요.",
    en: "A network error occurred. Please try again.",
  },
  errorEventFull: {
    ko: "안내드립니다. 준비된 모든 응모권이 모두 소진되어 더 이상 참여할 수 없습니다.",
    en: "Sorry, all prepared entries have been claimed and no further participation is possible.",
  },
  errorDuplicatePhone: {
    ko: "이미 참여하신 휴대전화 번호입니다.",
    en: "This phone number has already participated.",
  },
  errorInvalidPhone: {
    ko: "휴대전화 번호 형식을 확인해주세요.",
    en: "Please check your phone number format.",
  },
  errorInvalidEmail: { ko: "이메일 형식을 확인해주세요.", en: "Please check your email format." },
  langToggle: { ko: "ENGLISH", en: "한국어" },
};
