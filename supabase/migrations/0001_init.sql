-- =====================================================================
-- SH AI EXPO 2026 LUCKY DRAW - 초기 스키마
-- Supabase Dashboard > SQL Editor 에서 실행하거나
-- `supabase db push` (Supabase CLI) 로 적용한다.
-- =====================================================================

create extension if not exists "pgcrypto"; -- gen_random_uuid()

-- ---------------------------------------------------------------------
-- 1. prizes
-- ---------------------------------------------------------------------
create table if not exists prizes (
  id uuid primary key default gen_random_uuid(),
  rank int not null unique check (rank between 1 and 5),
  name text not null,
  initial_quantity int not null check (initial_quantity >= 0),
  remaining_quantity int not null check (remaining_quantity >= 0),
  display_order int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- 2. ticket_number 시퀀스 + participants
-- ---------------------------------------------------------------------
create sequence if not exists ticket_number_seq start 1 increment 1;

create table if not exists participants (
  id uuid primary key default gen_random_uuid(),
  ticket_number int not null unique default nextval('ticket_number_seq')
    check (ticket_number between 1 and 9999),
  name text not null,
  company text,
  phone text not null unique,
  email text not null,
  survey_answer_1 text not null,
  survey_answer_2 text not null,
  privacy_consent boolean not null default false,
  is_test boolean not null default false,
  created_at timestamptz not null default now(),
  drawn_at timestamptz,
  prize_id uuid references prizes(id),
  received boolean not null default false,
  received_at timestamptz
);

create index if not exists idx_participants_phone on participants(phone);
create index if not exists idx_participants_prize_id on participants(prize_id);
create index if not exists idx_participants_created_at on participants(created_at);

-- ---------------------------------------------------------------------
-- 3. draw_logs
-- ---------------------------------------------------------------------
create table if not exists draw_logs (
  id uuid primary key default gen_random_uuid(),
  participant_id uuid not null references participants(id),
  ticket_number int not null,
  prize_id uuid not null references prizes(id),
  prize_rank int not null,
  drawn_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- 4. event_settings (단일 row, id = 1)
-- ---------------------------------------------------------------------
create table if not exists event_settings (
  id int primary key default 1,
  allow_duplicate_phone boolean not null default false,
  test_mode boolean not null default false,
  updated_at timestamptz not null default now(),
  constraint single_row check (id = 1)
);

insert into event_settings (id, allow_duplicate_phone, test_mode)
values (1, false, false)
on conflict (id) do nothing;

-- =====================================================================
-- Row Level Security
-- =====================================================================
alter table prizes enable row level security;
alter table participants enable row level security;
alter table draw_logs enable row level security;
alter table event_settings enable row level security;

-- prizes: 재고 현황은 공개 데이터 (TV / 모바일 응모권에서 실시간 표시)
drop policy if exists "public read prizes" on prizes;
create policy "public read prizes" on prizes
  for select using (true);

-- participants / draw_logs / event_settings: anon/authenticated 완전 차단.
-- 모든 접근은 Next.js 서버(API Route)가 Service Role Key로만 수행한다.
-- (별도 정책을 추가하지 않으면 RLS 활성화 상태에서 기본적으로 전체 차단됨)

-- =====================================================================
-- Realtime: prizes 테이블만 publish (개인정보 테이블은 제외)
-- =====================================================================
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and tablename = 'prizes'
  ) then
    alter publication supabase_realtime add table prizes;
  end if;
exception when undefined_object then
  -- supabase_realtime publication이 없는 환경(로컬 등)에서는 무시
  raise notice 'supabase_realtime publication not found, skipping';
end $$;

-- =====================================================================
-- RPC 함수
-- 모두 SECURITY DEFINER + PUBLIC 권한 회수 후 service_role에만 부여한다.
-- => 브라우저(anon key)에서는 절대 직접 호출할 수 없고,
--    반드시 Next.js 서버(API Route, service role client)를 통해서만 호출된다.
-- =====================================================================

-- ---------------------------------------------------------------------
-- submit_survey: 설문 제출 + 응모번호 발급 (Atomic)
-- ---------------------------------------------------------------------
create or replace function submit_survey(
  p_name text,
  p_company text,
  p_phone text,
  p_email text,
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
    name, company, phone, email, survey_answer_1, survey_answer_2,
    privacy_consent, is_test
  ) values (
    p_name, nullif(p_company, ''), p_phone, p_email, p_answer1, p_answer2,
    true, coalesce(v_test_mode, false)
  )
  returning id, participants.ticket_number into v_id, v_ticket;

  return query select v_ticket, v_id;
exception
  when unique_violation then
    raise exception 'DUPLICATE_PHONE';
end;
$$;

-- ---------------------------------------------------------------------
-- draw_prize: 응모번호로 Lucky Draw 실행 (Atomic, Weighted Random)
-- ---------------------------------------------------------------------
create or replace function draw_prize(
  p_ticket_number int
) returns table(already_drawn boolean, prize_rank int, prize_name text)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_participant_id uuid;
  v_existing_prize uuid;
  v_total int;
  v_pick int;
  v_cursor int := 0;
  v_chosen_id uuid;
  v_chosen_rank int;
  v_chosen_name text;
  rec record;
begin
  -- 모든 추첨을 직렬화하여 재고 Race Condition을 원천 차단한다.
  perform pg_advisory_xact_lock(880022);

  select id, participants.prize_id into v_participant_id, v_existing_prize
  from participants
  where ticket_number = p_ticket_number;

  if v_participant_id is null then
    raise exception 'NOT_FOUND';
  end if;

  if v_existing_prize is not null then
    select prizes.rank, prizes.name into v_chosen_rank, v_chosen_name
    from prizes where id = v_existing_prize;

    return query select true, v_chosen_rank, v_chosen_name;
    return;
  end if;

  select coalesce(sum(remaining_quantity), 0) into v_total from prizes;

  if v_total <= 0 then
    raise exception 'SOLD_OUT';
  end if;

  v_pick := floor(random() * v_total)::int;

  for rec in
    select id, rank, name, remaining_quantity
    from prizes
    where remaining_quantity > 0
    order by display_order
  loop
    v_cursor := v_cursor + rec.remaining_quantity;
    if v_pick < v_cursor then
      v_chosen_id := rec.id;
      v_chosen_rank := rec.rank;
      v_chosen_name := rec.name;
      exit;
    end if;
  end loop;

  update prizes
    set remaining_quantity = remaining_quantity - 1, updated_at = now()
    where id = v_chosen_id;

  update participants
    set drawn_at = now(), prize_id = v_chosen_id
    where id = v_participant_id;

  insert into draw_logs (participant_id, ticket_number, prize_id, prize_rank)
    values (v_participant_id, p_ticket_number, v_chosen_id, v_chosen_rank);

  return query select false, v_chosen_rank, v_chosen_name;
end;
$$;

-- ---------------------------------------------------------------------
-- get_public_ticket_status: 개인정보 제외한 응모권 공개 정보 조회
-- ---------------------------------------------------------------------
create or replace function get_public_ticket_status(
  p_ticket_number int
) returns table(
  ticket_number int,
  drawn boolean,
  prize_rank int,
  prize_name text
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_prize_id uuid;
begin
  select participants.ticket_number, participants.prize_id
    into p_ticket_number, v_prize_id
  from participants
  where participants.ticket_number = p_ticket_number;

  if not found then
    raise exception 'NOT_FOUND';
  end if;

  if v_prize_id is null then
    return query select p_ticket_number, false, null::int, null::text;
  else
    return query
      select p_ticket_number, true, prizes.rank, prizes.name
      from prizes where id = v_prize_id;
  end if;
end;
$$;

-- ---------------------------------------------------------------------
-- admin_reset_event: 이벤트 데이터 초기화
-- p_scope: 'prizes_only' | 'full'
-- ---------------------------------------------------------------------
create or replace function admin_reset_event(
  p_scope text
) returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_scope = 'prizes_only' then
    update prizes set remaining_quantity = initial_quantity, updated_at = now();
  elsif p_scope = 'full' then
    delete from draw_logs;
    delete from participants;
    alter sequence ticket_number_seq restart with 1;
    update prizes set remaining_quantity = initial_quantity, updated_at = now();
  else
    raise exception 'INVALID_SCOPE';
  end if;
end;
$$;

-- ---------------------------------------------------------------------
-- 권한 정리: anon / authenticated 는 RPC를 직접 호출할 수 없다.
-- ---------------------------------------------------------------------
revoke execute on function submit_survey(text, text, text, text, text, text, boolean) from public;
revoke execute on function draw_prize(int) from public;
revoke execute on function get_public_ticket_status(int) from public;
revoke execute on function admin_reset_event(text) from public;

grant execute on function submit_survey(text, text, text, text, text, text, boolean) to service_role;
grant execute on function draw_prize(int) to service_role;
grant execute on function get_public_ticket_status(int) to service_role;
grant execute on function admin_reset_event(text) to service_role;
