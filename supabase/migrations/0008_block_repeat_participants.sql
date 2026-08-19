-- =====================================================================
-- SH AI EXPO 2026 LUCKY DRAW - 지난 라운드 참여자 재응모 차단
-- Supabase Dashboard > SQL Editor 에서 0007_round_archive.sql 이후 실행한다.
--
-- 지금까지는 라이브 participants 테이블 기준으로만 중복 전화번호를 막았다.
-- 라운드가 바뀌면(admin_start_new_round) 라이브 테이블이 비워지므로,
-- 1차에 참여했던 번호가 2차에도 그대로 다시 응모될 수 있었다.
-- 이제 보관 테이블(participants_archive)에 이미 있는 번호도 함께 막는다.
--
-- 함수 교체(create or replace)는 원자적이라, 이미 등록된 참가자/진행 중인 추첨에는
-- 영향을 주지 않고 이 시점 이후의 새 응모부터만 적용된다.
-- =====================================================================

create index if not exists idx_participants_archive_phone on public.participants_archive(phone);

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

  -- 지난 라운드(보관 테이블)에 이미 참여한 번호는 차단한다.
  if exists (select 1 from participants_archive where phone = p_phone) then
    raise exception 'DUPLICATE_PHONE';
  end if;

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
