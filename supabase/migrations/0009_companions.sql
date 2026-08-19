-- =====================================================================
-- SH AI EXPO 2026 LUCKY DRAW - 동반자 정보 수집
-- Supabase Dashboard > SQL Editor 에서 0008_block_repeat_participants.sql 이후 실행한다.
--
-- 동반자는 응모권(티켓)을 따로 받지 않는 정보성 기록이다(추첨은 신청자 1명만 참여).
-- 그래서 정원(MAX_PARTICIPANTS) 계산이나 draw_prize 로직은 전혀 건드리지 않는다.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. companions (라이브) - 신청자 삭제 시 동반자도 함께 삭제되도록 cascade
-- ---------------------------------------------------------------------
create table if not exists public.companions (
  id uuid primary key default gen_random_uuid(),
  participant_id uuid not null references public.participants(id) on delete cascade,
  name text not null,
  team text,
  "position" text,
  phone text not null,
  created_at timestamptz not null default now()
);

create index if not exists idx_companions_participant_id on public.companions(participant_id);

alter table public.companions enable row level security;
-- participants와 동일하게 anon/authenticated 전체 차단, service_role(서버)만 접근.

-- ---------------------------------------------------------------------
-- 2. companions_archive - 라운드 전환 시 참가자와 함께 보관
-- ---------------------------------------------------------------------
create table if not exists public.companions_archive (like public.companions including defaults);
alter table public.companions_archive add column if not exists archived_round int;

create index if not exists idx_companions_archive_round on public.companions_archive(archived_round);
alter table public.companions_archive enable row level security;

-- ---------------------------------------------------------------------
-- 3. submit_survey: 동반자 배열(p_companions)을 함께 받아 저장
-- p_companions: [{name, team, position, phone}, ...] (없으면 빈 배열 또는 null)
-- ---------------------------------------------------------------------
drop function if exists submit_survey(
  text, text, text, text, text, text, text, text, text, text, text, text, boolean
);

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
  p_consent boolean,
  p_companions jsonb
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
  c record;
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

  if p_companions is not null then
    for c in
      select * from jsonb_to_recordset(p_companions)
        as x(name text, team text, "position" text, phone text)
    loop
      insert into companions (participant_id, name, team, "position", phone)
      values (v_id, c.name, nullif(c.team, ''), nullif(c."position", ''), c.phone);
    end loop;
  end if;

  return query select v_ticket, v_id;
exception
  when unique_violation then
    raise exception 'DUPLICATE_PHONE';
end;
$$;

revoke execute on function submit_survey(
  text, text, text, text, text, text, text, text, text, text, text, text, boolean, jsonb
) from public;

grant execute on function submit_survey(
  text, text, text, text, text, text, text, text, text, text, text, text, boolean, jsonb
) to service_role;

-- ---------------------------------------------------------------------
-- 4. admin_start_new_round: 동반자도 함께 보관 + 초기화
-- (참가자 삭제 시 companions는 on delete cascade로 자동 정리되므로 별도 delete 불필요)
-- ---------------------------------------------------------------------
create or replace function public.admin_start_new_round(
  p_prizes jsonb
) returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  v_old_round int;
  v_new_round int;
  prize record;
begin
  perform pg_advisory_xact_lock(880044);

  select current_round into v_old_round from event_settings where id = 1;
  v_old_round := coalesce(v_old_round, 1);
  v_new_round := v_old_round + 1;

  -- 4-1) 현재 라운드 데이터를 보관 테이블로 복사 (원본은 아직 지우지 않음)
  -- companions는 participants를 지우면 cascade로 함께 사라지므로 반드시 먼저 복사한다.
  insert into companions_archive select c.*, v_old_round from companions c;
  insert into participants_archive select p.*, v_old_round from participants p;
  insert into draw_logs_archive select d.*, v_old_round from draw_logs d;
  insert into prizes_archive select pr.*, v_old_round from prizes pr;

  -- 4-2) 라이브 테이블 초기화
  delete from draw_logs where true;
  delete from participants where true; -- companions는 on delete cascade로 함께 삭제됨
  alter sequence ticket_number_seq restart with 1;
  delete from prizes where true;

  -- 4-3) 새 라운드 상품 구성 등록
  for prize in
    select * from jsonb_to_recordset(p_prizes)
      as x(rank int, name text, initial_quantity int, display_order int)
  loop
    insert into prizes (rank, name, initial_quantity, remaining_quantity, display_order)
    values (prize.rank, prize.name, prize.initial_quantity, prize.initial_quantity, prize.display_order);
  end loop;

  -- 4-4) 이벤트 설정을 새 라운드로 갱신
  update event_settings
    set current_round = v_new_round,
        rank1_fixed_draw_number = null,
        rank2_fixed_draw_number = null,
        rank3_fixed_draw_number = null,
        test_mode = false,
        updated_at = now()
    where id = 1;

  return v_new_round;
end;
$$;
