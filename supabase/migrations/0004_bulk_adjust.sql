-- Advaitum Business OS - 0004 bulk stock adjustment.
-- Run once in the Supabase SQL Editor (after 0001-0003). Safe to re-run.
-- Applies many stock adjustments in ONE transaction: if any line fails
-- (e.g. removing more than is in stock) nothing is changed.

create or replace function public.adjust_stock_bulk(p_items jsonb, p_reason text) returns integer
language plpgsql security definer set search_path=public as $$
declare v_it record; v_n int:=0;
begin
  if auth.uid() is null or not public.can_operate() then raise exception 'Not authorized'; end if;
  if p_items is null or jsonb_typeof(p_items)<>'array' or jsonb_array_length(p_items)=0 then raise exception 'Select at least one product'; end if;
  if jsonb_array_length(p_items)>200 then raise exception 'Too many lines (maximum 200 per update)'; end if;
  if length(trim(coalesce(p_reason,'')))=0 then raise exception 'A reason is required'; end if;
  -- ordered by product so concurrent bulk updates lock rows in the same order
  for v_it in
    select (e->>'product')::uuid as product, e->>'type' as typ, (e->>'qty')::numeric as qty, (e->>'unit_cost')::numeric as unit_cost
    from jsonb_array_elements(p_items) e order by 1
  loop
    perform public.adjust_stock(v_it.product, v_it.typ, v_it.qty, p_reason, v_it.unit_cost);
    v_n:=v_n+1;
  end loop;
  return v_n;
end $$;

revoke all on function public.adjust_stock_bulk(jsonb,text) from public,anon;
grant execute on function public.adjust_stock_bulk(jsonb,text) to authenticated;
