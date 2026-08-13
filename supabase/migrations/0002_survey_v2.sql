-- =====================================================================
-- SH AI EXPO 2026 LUCKY DRAW - 설문/참여자 정보 문항 개편 (v2)
-- Supabase Dashboard > SQL Editor 에서 0001_init.sql 이후 실행한다.
-- 기존 참여자 데이터가 있어도 안전하게 재실행 가능하다 (idempotent).
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. participants: 신규 컬럼 추가
-- ---------------------------------------------------------------------
alter table participants
  add column if not exists job_role text,
  add column if not exists rnd_dept text,
  add column if not exists rnd_dept_name text,
  add column if not exists rnd_relocation_plan text,
  add column if not exists hq_location text,
  add column if not exists hq_location_other text;

-- ---------------------------------------------------------------------
-- 2. submit_survey: 파라미터 구조가 바뀌었으므로 기존 함수를 제거 후 재생성한다.
-- ---------------------------------------------------------------------
drop function if exists submit_survey(text, text, text, text, text, text, boolean);

create or replace function submit_survey(
  p_name text,
  p_phone text,
  p_email text,
  p_company text,
  p_job_role text,
  p_rnd_dept text,
  p_rnd_dept_name text,
  p_rnd_relocation_plan text,
  p_hq_location text,
  p_hq_location_other text,
  p_answer1 text,
  p_answer2 text,
  p_consent boolean
) returns table(ticket_number int, participant_id uuid)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_test_mode boolean;
  v_max int;
  v_count int;
  v_id uuid;
  v_ticket int;
begin
  if not p_consent then
    raise exception 'PRIVACY_CONSENT_REQUIRED';
  end if;

  select test_mode into v_test_mode from event_settings where id = 1;

  -- 동시 제출에 대해 참여자 수 상한 체크를 직렬화한다.
  perform pg_advisory_xact_lock(880011);

  select coalesce(sum(initial_quantity), 0) into v_max from prizes;
  select count(*) into v_count from participants where is_test = false;

  if not coalesce(v_test_mode, false) and v_count >= v_max then
    raise exception 'EVENT_FULL';
  end if;

  insert into participants (
    name, phone, email, company,
    job_role, rnd_dept, rnd_dept_name, rnd_relocation_plan,
    hq_location, hq_location_other,
    survey_answer_1, survey_answer_2,
    privacy_consent, is_test
  ) values (
    p_name, p_phone, p_email, nullif(p_company, ''),
    nullif(p_job_role, ''), nullif(p_rnd_dept, ''), nullif(p_rnd_dept_name, ''), nullif(p_rnd_relocation_plan, ''),
    nullif(p_hq_location, ''), nullif(p_hq_location_other, ''),
    p_answer1, p_answer2,
    true, coalesce(v_test_mode, false)
  )
  returning id, participants.ticket_number into v_id, v_ticket;

  return query select v_ticket, v_id;
exception
  when unique_violation then
    raise exception 'DUPLICATE_PHONE';
end;
$$;

revoke execute on function submit_survey(
  text, text, text, text, text, text, text, text, text, text, text, text, boolean
) from public;

grant execute on function submit_survey(
  text, text, text, text, text, text, text, text, text, text, text, text, boolean
) to service_role;
