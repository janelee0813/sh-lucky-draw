-- =====================================================================
-- SH AI EXPO 2026 LUCKY DRAW - 1등을 특정 추첨 순번에 고정
-- Supabase Dashboard > SQL Editor 에서 0003_admin_delete_participant.sql 이후 실행한다.
--
-- event_settings.rank1_fixed_draw_number 를 N으로 설정하면:
--   - 전체 추첨 중 N번째 추첨에서 1등(rank=1) 재고가 남아있는 한 반드시 1등이 나온다.
--   - N번째에 도달하기 전까지는 1등이 랜덤 추첨 대상에서 제외된다(조기 소진 방지).
--   - N번째를 이미 지났는데도 1등 재고가 남아있다면(예: 순번 재설정 등) 이후 추첨부터는
--     다시 랜덤 대상에 포함시켜 상품이 묶여있지 않도록 한다.
--   - null이면 기존과 동일하게 완전 랜덤으로 동작한다.
-- =====================================================================

alter table event_settings add column if not exists rank1_fixed_draw_number int;

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
  v_current_draw_number int;
  v_target int;
  v_rank1_remaining int;
  v_force_rank1 boolean := false;
  v_exclude_rank1 boolean := false;
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

  select (select count(*) from draw_logs) + 1 into v_current_draw_number;
  select rank1_fixed_draw_number into v_target from event_settings where id = 1;
  select remaining_quantity into v_rank1_remaining from prizes where rank = 1;

  if v_target is not null and coalesce(v_rank1_remaining, 0) > 0 then
    if v_current_draw_number >= v_target then
      v_force_rank1 := true;
    else
      v_exclude_rank1 := true;
    end if;
  end if;

  if v_force_rank1 then
    select id, rank, name into v_chosen_id, v_chosen_rank, v_chosen_name
    from prizes where rank = 1;
  else
    v_total := 0;
    for rec in
      select id, rank, name, remaining_quantity
      from prizes
      where remaining_quantity > 0 and (not v_exclude_rank1 or rank <> 1)
      order by display_order
    loop
      v_total := v_total + rec.remaining_quantity;
    end loop;

    -- 1등을 제외하면 뽑을 상품이 없는 경우(사실상 1등만 남은 상황)에는
    -- 제외 규칙을 무시하고 1등을 포함해 정상적으로 추첨한다.
    if v_total <= 0 then
      v_exclude_rank1 := false;
      for rec in
        select id, rank, name, remaining_quantity
        from prizes
        where remaining_quantity > 0
        order by display_order
      loop
        v_total := v_total + rec.remaining_quantity;
      end loop;
    end if;

    v_pick := floor(random() * v_total)::int;

    for rec in
      select id, rank, name, remaining_quantity
      from prizes
      where remaining_quantity > 0 and (not v_exclude_rank1 or rank <> 1)
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
  end if;

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

revoke execute on function draw_prize(int) from public;
grant execute on function draw_prize(int) to service_role;
