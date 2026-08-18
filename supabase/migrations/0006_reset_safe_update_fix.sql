-- =====================================================================
-- SH AI EXPO 2026 LUCKY DRAW - 전체 초기화(admin_reset_event) 오류 수정
-- Supabase Dashboard > SQL Editor 에서 0005_rank123_fixed_draw.sql 이후 실행한다.
--
-- Supabase Postgres는 기본적으로 WHERE절 없는 DELETE/UPDATE를 차단한다
-- ("DELETE requires a WHERE clause"). admin_reset_event가 의도적으로
-- 전체 행을 지우고/갱신하려다 이 안전장치에 막혀 실패하던 문제를 고친다.
-- 동작 자체는 기존과 동일(전체 삭제/전체 갱신)하며, 형식적으로 where true를 붙인다.
-- =====================================================================

create or replace function admin_reset_event(
  p_scope text
) returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_scope = 'prizes_only' then
    update prizes set remaining_quantity = initial_quantity, updated_at = now() where true;
  elsif p_scope = 'full' then
    delete from draw_logs where true;
    delete from participants where true;
    alter sequence ticket_number_seq restart with 1;
    update prizes set remaining_quantity = initial_quantity, updated_at = now() where true;
  else
    raise exception 'INVALID_SCOPE';
  end if;
end;
$$;

revoke execute on function admin_reset_event(text) from public;
grant execute on function admin_reset_event(text) to service_role;
