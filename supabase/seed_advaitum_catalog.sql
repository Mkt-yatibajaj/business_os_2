-- Optional: Seed Advaitum Default Categories, Suppliers & Crystal SKUs
-- Run in Supabase SQL Editor after migrations if you want your initial Advaitum catalogue pre-populated.

insert into public.categories (name) values
  ('Rudraksha & Malas'),
  ('Crystal Bracelets'),
  ('Crystal Trees'),
  ('Pendants & Anklets')
on conflict (name) do nothing;

insert into public.suppliers (name, phone, email, notes) values
  ('Khambhat Agate & Crystal Artisans', '+91 98250 11223', 'orders@khambhatcrystals.in', 'Primary crystal bracelets, trees & raw pyrite supplier'),
  ('Kashi Rudraksha Direct', '+91 94152 33445', 'supply@kashirudraksha.com', 'Certified Nepal & Java Rudraksha beads and malas'),
  ('Jaipur Gemstones & Lapidary House', '+91 98290 55667', 'wholesale@jaipurgems.in', 'Raw pyrite anklets, tumbled stones, and pendants')
on conflict do nothing;

do $$
declare
  c_mala uuid;
  c_brac uuid;
  c_tree uuid;
  c_pend uuid;
begin
  select id into c_mala from public.categories where name = 'Rudraksha & Malas' limit 1;
  select id into c_brac from public.categories where name = 'Crystal Bracelets' limit 1;
  select id into c_tree from public.categories where name = 'Crystal Trees' limit 1;
  select id into c_pend from public.categories where name = 'Pendants & Anklets' limit 1;

  insert into public.products (sku, name, category_id, unit, selling_price, reorder_level) values
    ('ADV-RUD-001', 'Five Mukhi Rudraksha Mala', c_mala, 'piece', 399.00, 10),
    ('ADV-CRY-002', 'Amethyst Bracelet', c_brac, 'piece', 599.00, 10),
    ('ADV-BRC-003', 'Seven Chakra Bracelet', c_brac, 'piece', 649.00, 8),
    ('ADV-PND-004', 'Crystal Pendant', c_pend, 'piece', 499.00, 10),
    ('ADV-ANK-005', 'Raw Pyrite Anklet', c_pend, 'piece', 899.00, 8),
    ('ADV-TRE-006', '7 Chakras Crystal Tree (300 Beads)', c_tree, 'piece', 1299.00, 5),
    ('ADV-TRE-007', 'Money Magnet Crystal Tree (Pyrite & Citrine)', c_tree, 'piece', 1499.00, 5)
  on conflict (sku) do nothing;
end $$;
