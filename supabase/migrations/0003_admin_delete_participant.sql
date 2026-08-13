-- =====================================================================
-- SH AI EXPO 2026 LUCKY DRAW - 관리자: 참가자 삭제 (테스트/오입력 정리용)
-- Supabase Dashboard > SQL Editor 에서 0002_survey_v2.sql 이후 실행한다.
-- =====================================================================

-- ---------------------------------------------------------------------
-- admin_delete_participant: 참가자 1명을 삭제한다.
-- 이미 당첨된 상태였다면 해당 상품의 remaining_quantity를 1 복구한 뒤 삭제한다.
-- (draw_logs도 함께 삭제하여 참조 무결성을 유지한다)
-- ---------------------------------------------------------------------
create or replace function admin_delete_participant(
  p_id uuid
) returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_prize_id uuid;
begin
  perform pg_advisory_xact_lock(880033);

  select prize_id into v_prize_id from participants where id = p_id;

  if not found then
    raise exception 'NOT_FOUND';
  end if;

  if v_prize_id is not null then
    update prizes
      set remaining_quantity = remaining_quantity + 1, updated_at = now()
      where id = v_prize_id;
  end if;

  delete from draw_logs where participant_id = p_id;
  delete from participants where id = p_id;
end;
$$;

revoke execute on function admin_delete_participant(uuid) from public;
grant execute on function admin_delete_participant(uuid) to service_role;
