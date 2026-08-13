# SH AI EXPO 2026 — LUCKY DRAW

SH서울주택도시개발공사 AI EXPO 2026 부스용 설문 + Lucky Draw 이벤트 웹서비스입니다.
QR 모바일 설문 → 응모번호 발급 → 55인치 터치스크린 TV 추첨 → 관리자 대시보드까지
하나의 웹서비스로 동작합니다.

- 프론트엔드: Next.js 14 (App Router) + TypeScript + Tailwind CSS + Framer Motion
- 백엔드: Next.js API Route (Server Action 방식) + Supabase (PostgreSQL, Realtime)
- 배포: Vercel

---

## 1. 상품 구성 (총 200개)

| 등수 | 상품 | 수량 |
| -- | -- | --: |
| 1 | AirPods 4 | 1 |
| 2 | Belkin 충전기 | 5 |
| 3 | Re:QM 여행용 충전기 | 10 |
| 4 | 편의점 상품권 | 100 |
| 5 | Haribo 젤리 간식 | 84 |
| **합계** | | **200** |

`src/lib/config/settings.ts`의 `PRIZE_SEED`에서 수정할 수 있습니다. (수정 시 `supabase/seed.sql`도 함께 수정)

### 참여/추첨 마감 규칙 (요청사항 반영)

- **설문 마감**: 응모권은 상품 수(200개)만큼만 발급됩니다. 정식 참여자 수가 200명에 도달하면
  `/survey`는 자동으로 "참여 마감" 화면을 보여주고, 서버(`submit_survey` RPC)도 동일 기준으로
  신규 제출을 차단합니다. (TEST MODE로 등록된 참여자는 이 카운트에서 제외됩니다)
- **추첨 마감**: 전체 상품 재고 합계가 0이 되는 순간 `/api/draw`가 `SOLD_OUT` 오류를 반환하며,
  TV 화면의 "이벤트 응모하기" 버튼도 비활성화되고 "이벤트가 종료되었습니다"로 바뀝니다.

---

## 2. 페이지 구조

```
/                       TV Lucky Draw 메인 화면 (55인치 터치스크린, 16:9 고정비율)
/survey                 모바일 설문 참여 페이지
/ticket/[ticketNumber]  응모권 확인 페이지 (개인정보 미노출)
/admin                  관리자 페이지 (로그인 필요)
```

---

## 3. 설치 및 로컬 실행

### 3-1. 의존성 설치

```bash
npm install
```

### 3-2. Supabase 프로젝트 생성

1. [supabase.com](https://supabase.com) 에서 새 프로젝트를 생성합니다.
2. **Project Settings > API** 에서 아래 3개 값을 확인합니다.
   - `Project URL` → `NEXT_PUBLIC_SUPABASE_URL`
   - `anon public` key → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `service_role` key → `SUPABASE_SERVICE_ROLE_KEY` (**절대 외부에 노출하지 마세요**)

### 3-3. 환경변수 설정

```bash
cp .env.example .env.local
```

`.env.local`을 열어 위에서 확인한 값과 원하는 비밀번호를 입력합니다.

```env
NEXT_PUBLIC_SUPABASE_URL=https://xxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=xxxxx
SUPABASE_SERVICE_ROLE_KEY=xxxxx
ADMIN_PASSWORD=7890
STAFF_PASSWORD=원하는_현장운영자_비밀번호
SESSION_SECRET=openssl rand -hex 32 로 생성한 임의의 긴 문자열
```

### 3-4. Database Migration 실행

Supabase Dashboard 좌측 메뉴 **SQL Editor**를 열고, 아래 두 파일의 내용을
**순서대로** 붙여넣어 실행합니다.

1. `supabase/migrations/0001_init.sql` — 테이블, RLS, RPC 함수 생성
2. `supabase/seed.sql` — 상품 Seed Data(200개) 삽입

> Supabase CLI를 사용하는 경우 `supabase db push` 로도 동일하게 적용할 수 있습니다.

### 3-5. Seed 실행 (선택)

코드에서 관리하는 `PRIZE_SEED` 기준으로 상품 데이터를 다시 동기화하고 싶다면:

```bash
npm run seed
```

(이미 `supabase/seed.sql`을 실행했다면 생략해도 됩니다. 참가자 데이터는 건드리지 않습니다.)

### 3-6. 로컬 실행

```bash
npm run dev
```

- TV 화면: http://localhost:3000
- 설문: http://localhost:3000/survey
- 관리자: http://localhost:3000/admin

---

## 4. Vercel 배포 방법

1. GitHub 등에 이 프로젝트를 push 합니다.
2. [vercel.com](https://vercel.com) 에서 New Project → 해당 저장소 선택.
3. **Environment Variables**에 `.env.local`과 동일한 6개 값을 등록합니다.
   (`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`,
   `SUPABASE_SERVICE_ROLE_KEY`, `ADMIN_PASSWORD`, `STAFF_PASSWORD`, `SESSION_SECRET`)
4. Deploy. 빌드 커맨드/출력 디렉토리는 Next.js 기본값 그대로 사용하면 됩니다.
5. 배포된 도메인의 `/` 를 현장 터치스크린 TV 브라우저에 전체화면(Kiosk 모드)으로 띄웁니다.

---

## 5. 관리자 사용법

1. `/admin` 접속 → 비밀번호(`ADMIN_PASSWORD`, 기본 `7890`) 입력.
2. **DASHBOARD**: 총 참여/추첨완료/추첨대기/남은 상품 통계와 상품별 현황을 확인합니다.
3. **PARTICIPANTS**: 응모번호/이름/휴대전화/회사/이메일로 검색, 상태별 필터(전체·미추첨·추첨완료·등수별),
   상품 수령 여부 체크, **Excel 다운로드**를 제공합니다.
4. **PRIZES**: 상품별 초기수량을 수정할 수 있습니다. (이미 당첨된 수량보다 적게는 설정 불가)
5. **SETTINGS**:
   - `TEST MODE`: 켜면 이후 설문 제출은 테스트 데이터로 표시되고 참여 인원 상한에서 제외됩니다.
     리허설용으로 사용 후 반드시 초기화하세요.
   - 이벤트 데이터 초기화: `상품 재고만 초기화` 또는 `참가자+당첨 데이터 전체 초기화` 중 선택,
     확인 문구에 `RESET`을 입력해야 실행됩니다. **되돌릴 수 없습니다.**

---

## 6. 현장 운영자(TV) 사용법

1. TV 브라우저에서 `/` 접속 시 최초 1회 **Staff 비밀번호**(`STAFF_PASSWORD`) 입력 화면이 뜹니다.
   입력 후에는 세션 쿠키로 약 16시간 동안 재인증 없이 사용할 수 있습니다.
2. 참가자가 모바일에서 받은 4자리 응모번호를 안내받아, 화면 우측 하단
   **"이벤트 응모하기"** 버튼 → 화면 Numeric Keypad로 입력 → **"추첨 시작"**.
3. 약 8~9초의 연출 후 결과가 표시됩니다. **"확인"**을 누르면 기본 화면으로 돌아갑니다.
4. 우측 상단의 작은 **"사용자 화면"** 버튼으로 모바일 설문 화면을 미리보기할 수 있습니다.
5. 인터넷이 불안정해 오류가 나면, 같은 응모번호로 다시 시도해도 안전합니다.
   서버가 이미 처리한 결과가 있으면 중복 당첨 없이 기존 결과가 그대로 표시됩니다.

---

## 7. Database 구조 요약

- `prizes` — 등수/상품명/초기수량/남은수량
- `participants` — 응모번호(순번, 0001~9999), 참여자 정보, 설문 응답, 개인정보 동의,
  추첨 시각, 당첨 상품, 수령 여부
- `draw_logs` — 추첨 이력(감사 로그)
- `event_settings` — TEST MODE 등 운영 설정 (단일 row)

핵심 무결성은 Postgres 레벨에서 보장됩니다.

- `ticket_number`, `phone` UNIQUE 제약
- `submit_survey`, `draw_prize` RPC는 `pg_advisory_xact_lock` + 단일 Transaction으로
  동시 요청에서도 재고가 음수가 되거나 한 응모권이 두 번 당첨되는 일이 없도록 처리합니다.
- 모든 RPC는 `service_role`에만 실행 권한이 있어, 브라우저(anon key)에서 직접 호출할 수 없습니다.
- 참가자 개인정보(`participants`, `draw_logs`)는 RLS로 보호되어 anon key로는 절대 조회되지
  않습니다. `/ticket/[ticketNumber]`, TV 화면 등 공개 화면은 개인정보가 없는
  `get_public_ticket_status` RPC 또는 `prizes` 테이블(공개 데이터)만 사용합니다.

---

## 8. 리허설(사전 테스트) 체크리스트

1. **환경변수 확인**: 실제 Supabase 프로젝트 URL/Key가 정확히 들어갔는지, `ADMIN_PASSWORD` /
   `STAFF_PASSWORD`를 실제 값으로 변경했는지 확인합니다.
2. **Migration 재확인**: `supabase/migrations/0001_init.sql`, `supabase/seed.sql`이 정상 실행되어
   `prizes` 테이블에 5개 row(총 200개)가 있는지 Supabase Table Editor에서 확인합니다.
3. **TEST MODE 켜기**: `/admin` → SETTINGS → TEST MODE ON.
4. **설문 → 응모권 → TV 추첨** 전체 플로우를 여러 번 반복 테스트합니다.
   - 서로 다른 휴대전화 번호로 여러 명 설문 제출 → 응모번호가 0001, 0002...로 순차 발급되는지 확인
   - 동일 휴대전화로 재제출 시 "이미 참여하신 번호" 안내가 뜨는지 확인
   - 존재하지 않는 응모번호(예: 9999)로 TV에서 추첨 시도 시 오류가 뜨는지 확인
   - 정상 응모번호로 추첨 → 상품 재고가 TV/응모권 화면에서 실시간으로 줄어드는지 확인
   - 같은 응모번호로 TV에서 다시 추첨 시도 시, 새 상품이 아니라 기존 결과가 그대로 뜨는지 확인
5. **동시성 테스트**: 가능하다면 여러 기기(또는 여러 탭)에서 서로 다른 응모번호로 거의 동시에
   추첨을 시도해, 재고가 음수로 내려가지 않는지 확인합니다.
6. **관리자 확인**: `/admin` PARTICIPANTS에서 방금 테스트한 데이터가 `TEST` 표시와 함께
   보이는지, Excel 다운로드 시 한글이 깨지지 않는지 확인합니다.
7. **TEST 데이터 초기화**: `/admin` → SETTINGS → "참가자 + 당첨 데이터 전체 초기화" 실행,
   `RESET` 입력 후 확인. `PRIZES` 탭에서 남은 수량이 다시 초기수량(1/5/10/100/84)으로
   돌아왔는지 확인합니다.
8. **TEST MODE 끄기**: SETTINGS에서 TEST MODE를 다시 OFF로 돌립니다. (실제 행사 데이터가
   테스트로 잘못 분류되지 않도록)
9. **TV 화면 최종 점검**: 실제 사용할 55인치 터치스크린 해상도(예: 1920×1080)에서 브라우저를
   전체화면으로 띄우고, 스크롤 없이 16:9 비율이 깨지지 않는지, 터치 응답이 원활한지 확인합니다.
10. **Staff 로그인**: TV 화면에서 STAFF 비밀번호로 로그인 후, 행사 시작 전 재로그인 없이
    유지되는지 확인합니다.
11. **행사 시작**: 위 항목이 모두 정상이면 실제 행사를 시작합니다.

---

## 9. 아직 실제 행사 전에 확인해야 하는 항목

- 실제 공식 SH 로고/CI 파일을 받아 TV 화면 및 응모권 디자인에 반영 (현재는 텍스트 워드마크로 대체)
- 실제 전시장 Wi-Fi 환경에서의 API 응답 속도 테스트
- 55인치 터치스크린 실기기에서의 터치 반응성/키패드 오타율 확인
- Supabase 프로젝트의 Region이 전시장과 지리적으로 가까운지 (지연시간)
- `ADMIN_PASSWORD`, `STAFF_PASSWORD`, `SESSION_SECRET`을 실제 운영용 값으로 교체했는지
  (현재 예시 값 `7890` 등은 반드시 변경 권장)
- 상품 수령 프로세스(당첨자가 실물 수령 시 관리자가 "수령완료" 체크) 현장 운영자 교육
