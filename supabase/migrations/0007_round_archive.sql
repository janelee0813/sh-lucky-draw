-- =====================================================================
-- SH AI EXPO 2026 LUCKY DRAW - 라운드 전환(1차 -> 2차) 지원
-- Supabase Dashboard > SQL Editor 에서 0006_reset_safe_update_fix.sql 이후 실행한다.
--
-- 기존 admin_reset_event('full')은 참가자/추첨기록을 완전히 지워버렸다.
-- 이번 마이그레이션은 "지우기 전에 현재 라운드 데이터를 보관 테이블로 복사"한 뒤
-- 라이브 테이블을 새 라운드 상품 구성으로 초기화하는 admin_start_new_round()를 추가한다.
-- 라이브 테이블(prizes/participants/draw_logs) 구조는 전혀 바뀌지 않으므로
-- 기존 submit_survey/draw_prize/조회 API/화면은 수정 없이 그대로 동작한다.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. 보관 테이블 (라이브 테이블과 동일한 컬럼 + archived_round)
-- ---------------------------------------------------------------------
create table if not exists public.participants_archive (like public.participants including defaults);
alter table public.participants_archive add column if not exists archived_round int;

create table if not exists public.draw_logs_archive (like public.draw_logs including defaults);
alter table public.draw_logs_archive add column if not exists archived_round int;

create table if not exists public.prizes_archive (like public.prizes including defaults);
alter table public.prizes_archive add column if not exists archived_round int;

create index if not exists idx_participants_archive_round on public.participants_archive(archived_round);
create index if not exists idx_draw_logs_archive_round on public.draw_logs_archive(archived_round);
create index if not exists idx_prizes_archive_round on public.prizes_archive(archived_round);

alter table public.participants_archive enable row level security;
alter table public.draw_logs_archive enable row level security;
alter table public.prizes_archive enable row level security;
-- 정책을 추가하지 않으므로 라이브 테이블과 동일하게 anon/authenticated는 완전 차단되고,
-- 서버(service role)만 조회/기록할 수 있다.

-- ---------------------------------------------------------------------
-- 2. 지금이 몇 차 라운드인지 기록
-- ---------------------------------------------------------------------
alter table public.event_settings add column if not exists current_round int not null default 1;

-- ---------------------------------------------------------------------
-- 3. admin_start_new_round: 현재 라운드를 보관하고 새 라운드로 초기화
-- p_prizes: [{rank, name, initial_quantity, display_order}, ...]
-- 반환값: 새로 시작된 라운드 번호
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

  -- 3-1) 현재 라운드 데이터를 보관 테이블로 복사 (원본은 아직 지우지 않음)
  insert into participants_archive select p.*, v_old_round from participants p;
  insert into draw_logs_archive select d.*, v_old_round from draw_logs d;
  insert into prizes_archive select pr.*, v_old_round from prizes pr;

  -- 3-2) 라이브 테이블 초기화 (기존 admin_reset_event('full')과 동일한 순서/방식)
  delete from draw_logs where true;
  delete from participants where true;
  alter sequence ticket_number_seq restart with 1;
  delete from prizes where true;

  -- 3-3) 새 라운드 상품 구성 등록
  for prize in
    select * from jsonb_to_recordset(p_prizes)
      as x(rank int, name text, initial_quantity int, display_order int)
  loop
    insert into prizes (rank, name, initial_quantity, remaining_quantity, display_order)
    values (prize.rank, prize.name, prize.initial_quantity, prize.initial_quantity, prize.display_order);
  end loop;

  -- 3-4) 이벤트 설정을 새 라운드로 갱신
  -- 고정 추첨 순번(rank1/2/3_fixed_draw_number)은 이전 라운드 추첨 순번 기준값이라
  -- 새 라운드에는 그대로 쓸 수 없으므로 초기화한다. 필요하면 관리자가 새로 설정한다.
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

revoke execute on function public.admin_start_new_round(jsonb) from public;
grant execute on function public.admin_start_new_round(jsonb) to service_role;
