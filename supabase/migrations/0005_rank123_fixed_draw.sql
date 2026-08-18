-- =====================================================================
-- SH AI EXPO 2026 LUCKY DRAW - 1/2/3등을 특정 추첨 순번에 고정 (2/3등은 확장)
-- Supabase Dashboard > SQL Editor 에서 0004_rank1_fixed_draw.sql 이후 실행한다.
--
-- event_settings.rank{1,2,3}_fixed_draw_number 를 각각 N으로 설정하면,
-- 해당 등수의 "마지막 1개"에 한해서만 순번이 고정된다.
--   - 그 등수의 재고가 아직 2개 이상 남아있는 동안은 지금처럼 완전 랜덤으로 섞여 나간다.
--   - 재고가 1개(=마지막 하나)만 남은 시점부터:
--       - N번째 이전 추첨에서는 그 마지막 1개가 랜덤 추첨 대상에서 제외된다(조기 소진 방지).
--       - N번째 추첨에 도달하면 반드시 그 마지막 1개가 나온다.
--   - N번째를 이미 지났는데도 마지막 1개가 남아있다면(순번 재설정 등) 다음 추첨에서 바로
--     나오도록 하여 상품이 영원히 묶이지 않게 한다.
--   - 1/2/3등의 조건이 동시에 "강제 확정" 상태가 되면 1등 > 2등 > 3등 순으로 우선한다
--     (동시 충돌은 사실상 발생하지 않지만 안전장치로 둔다).
--   - null이면 해당 등수는 기존과 동일하게 완전 랜덤으로 동작한다.
-- =====================================================================

alter table event_settings add column if not exists rank2_fixed_draw_number int;
alter table event_settings add column if not exists rank3_fixed_draw_number int;

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
  v_targets int[];
  v_remaining int;
  v_exclude_ranks int[] := array[]::int[];
  v_forced_rank int;
  v_rank int;
  v_target int;
  i int;
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

  select array[rank1_fixed_draw_number, rank2_fixed_draw_number, rank3_fixed_draw_number]
    into v_targets
    from event_settings where id = 1;

  -- 1등 > 2등 > 3등 순으로 훑으면서, 강제 확정 대상은 첫 번째로 만난 등수 하나만 채택한다.
  for i in 1..3 loop
    v_rank := i;
    v_target := v_targets[i];
    if v_target is not null then
      select remaining_quantity into v_remaining from prizes where rank = v_rank;
      if coalesce(v_remaining, 0) = 1 then
        if v_current_draw_number >= v_target then
          if v_forced_rank is null then
            v_forced_rank := v_rank;
          end if;
        else
          v_exclude_ranks := v_exclude_ranks || v_rank;
        end if;
      end if;
    end if;
  end loop;

  if v_forced_rank is not null then
    select id, rank, name into v_chosen_id, v_chosen_rank, v_chosen_name
    from prizes where rank = v_forced_rank;
  else
    v_total := 0;
    for rec in
      select id, rank, name, remaining_quantity
      from prizes
      where remaining_quantity > 0 and rank <> all(v_exclude_ranks)
      order by display_order
    loop
      v_total := v_total + rec.remaining_quantity;
    end loop;

    -- 제외 대상 때문에 뽑을 상품이 하나도 안 남는 예외 상황(=제외된 등수들만 재고가 있음)
    -- 에서는 제외 규칙을 무시하고 정상적으로 추첨한다.
    if v_total <= 0 then
      v_exclude_ranks := array[]::int[];
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
      where remaining_quantity > 0 and rank <> all(v_exclude_ranks)
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
