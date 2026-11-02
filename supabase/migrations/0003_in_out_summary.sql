-- Advaitum Business OS - 0003 Products In/Out Cumulative View & Commercial Seed Helper
-- Run AFTER 0001_advaitum_core.sql and 0002_operations.sql.

create or replace view public.inventory_summary with (security_invoker=true) as
with lot_totals as (
  select
    product_id,
    coalesce(sum(quantity_remaining), 0)::numeric(14,3) as stock,
    coalesce(sum(quantity_remaining * (unit_purchase_cost + allocated_landed_cost / quantity_received)), 0)::numeric(14,2) as stock_value
  from public.purchase_lots
  group by product_id
),
move_totals as (
  select
    product_id,
    coalesce(sum(case when quantity_delta > 0 then quantity_delta else 0 end), 0)::numeric(14,3) as total_in,
    coalesce(sum(case when quantity_delta < 0 then abs(quantity_delta) else 0 end), 0)::numeric(14,3) as total_out
  from public.stock_movements
  group by product_id
)
select
  p.id,
  p.sku,
  p.name,
  p.unit,
  p.selling_price,
  p.reorder_level,
  coalesce(l.stock, 0)::numeric(14,3) as stock,
  coalesce(l.stock_value, 0)::numeric(14,2) as stock_value,
  coalesce(m.total_in, 0)::numeric(14,3) as total_in,
  coalesce(m.total_out, 0)::numeric(14,3) as total_out
from public.products p
left join lot_totals l on l.product_id = p.id
left join move_totals m on m.product_id = p.id;

grant select on public.inventory_summary to authenticated;
