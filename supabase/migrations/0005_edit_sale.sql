-- Advaitum Business OS - 0005 owner-only sale editing.
-- Run once in the Supabase SQL Editor. Safe to re-run.
-- Lets the OWNER correct a posted sale's date, channel, order details, discount/fees/shipping,
-- sale number and per-line selling prices. Products and quantities are NOT editable here
-- (they move stock): for those, cancel the sale and record it again.
-- Every edit writes the before/after values to the activity log.

create or replace function public.update_sale(
  p_sale uuid, p_sold_at timestamptz, p_channel text, p_location text, p_order_ref text, p_payment text,
  p_discount numeric, p_fees numeric, p_shipping numeric, p_notes text, p_sale_number text,
  p_prices jsonb default '[]'::jsonb) returns void
language plpgsql security definer set search_path=public as $$
declare v_uid uuid:=auth.uid(); v_old jsonb; v_old_items jsonb; v_s record; v_gross numeric; v_pr record; v_new jsonb;
begin
  if v_uid is null or public.current_role()<>'owner' then raise exception 'Only the owner can edit a sale'; end if;
  select * into v_s from public.sales where id=p_sale for update;
  if not found then raise exception 'Sale not found'; end if;
  if v_s.status<>'posted' then raise exception 'A cancelled sale cannot be edited'; end if;
  if p_sold_at is null then raise exception 'Date is required'; end if;
  if length(trim(coalesce(p_channel,'')))=0 then raise exception 'Sales channel is required'; end if;
  if length(trim(coalesce(p_sale_number,'')))=0 then raise exception 'Sale number is required'; end if;
  if coalesce(p_discount,0)<0 or coalesce(p_fees,0)<0 or coalesce(p_shipping,0)<0 then raise exception 'Invalid amounts'; end if;
  if p_sold_at > now()+interval '1 day' then raise exception 'Sale date cannot be in the future'; end if;

  if exists(select 1 from public.sales where sale_number=trim(p_sale_number) and id<>p_sale) then raise exception 'Sale number % is already used by another sale',trim(p_sale_number); end if;

  v_old:=to_jsonb(v_s);
  select coalesce(jsonb_agg(jsonb_build_object('item',id,'price',unit_selling_price)),'[]') into v_old_items from public.sale_items where sale_id=p_sale;

  if p_prices is not null and jsonb_typeof(p_prices)='array' then
    for v_pr in select (e->>'item')::uuid as item,(e->>'price')::numeric as price from jsonb_array_elements(p_prices) e loop
      if v_pr.price is null or v_pr.price<0 then raise exception 'Invalid selling price'; end if;
      update public.sale_items set unit_selling_price=v_pr.price,line_revenue=round(quantity*v_pr.price,2) where id=v_pr.item and sale_id=p_sale;
      if not found then raise exception 'Line does not belong to this sale'; end if;
    end loop;
  end if;

  select coalesce(sum(line_revenue),0) into v_gross from public.sale_items where sale_id=p_sale;
  if coalesce(p_discount,0)>v_gross then raise exception 'Discount cannot exceed the sale total'; end if;

  update public.sales set sold_at=p_sold_at,channel=trim(p_channel),location=nullif(trim(coalesce(p_location,'')),''),
    external_order_reference=nullif(trim(coalesce(p_order_ref,'')),''),payment_method=nullif(trim(coalesce(p_payment,'')),''),
    discount_amount=coalesce(p_discount,0),selling_fees=coalesce(p_fees,0),shipping_cost=coalesce(p_shipping,0),
    notes=nullif(trim(coalesce(p_notes,'')),''),sale_number=trim(p_sale_number) where id=p_sale;

  select to_jsonb(s) into v_new from public.sales s where id=p_sale;
  insert into public.audit_log(actor_id,action,table_name,record_id,details)
    values(v_uid,'sale_edited','sales',p_sale::text,jsonb_build_object('number',trim(p_sale_number),'before',v_old,'before_prices',v_old_items,'after',v_new));
end $$;

revoke all on function public.update_sale(uuid,timestamptz,text,text,text,text,numeric,numeric,numeric,text,text,jsonb) from public,anon;
grant execute on function public.update_sale(uuid,timestamptz,text,text,text,text,numeric,numeric,numeric,text,text,jsonb) to authenticated;
