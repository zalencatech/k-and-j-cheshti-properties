-- ============================================================================
-- K&J CHESHTI PROPERTIES — COMPLETE SUPABASE SETUP
-- Paste this ENTIRE file into Supabase → SQL Editor → Run
-- Safe to re-run: uses IF NOT EXISTS / DROP ... IF EXISTS guards where sensible
-- ============================================================================

create extension if not exists "uuid-ossp";

-- ============================================================================
-- 1. ENUMS
-- ============================================================================
do $$ begin
  create type user_role as enum ('admin','staff');
exception when duplicate_object then null; end $$;

do $$ begin
  create type asset_category as enum ('commercial','residential');
exception when duplicate_object then null; end $$;

do $$ begin
  create type unit_type as enum ('commercial_unit','house','bed');
exception when duplicate_object then null; end $$;

do $$ begin
  create type unit_status as enum ('occupied','vacant','reserved','maintenance');
exception when duplicate_object then null; end $$;

do $$ begin
  create type payment_method as enum ('cash','bank_transfer');
exception when duplicate_object then null; end $$;

-- ============================================================================
-- 2. CORE TABLES
-- ============================================================================

-- Profiles: one row per Supabase Auth user, holds role
create table if not exists profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  full_name text,
  role user_role not null default 'staff',
  created_at timestamptz not null default now()
);

-- Properties (physical properties)
create table if not exists properties (
  id uuid primary key default uuid_generate_v4(),
  name text not null unique,
  created_at timestamptz not null default now()
);

-- Assets = a property's use-category (e.g. "Barkat Market Heights - Commercial")
create table if not exists assets (
  id uuid primary key default uuid_generate_v4(),
  property_id uuid not null references properties(id) on delete cascade,
  category asset_category not null,
  name text not null, -- display name, e.g. "Barkat Market Heights (Commercial)"
  created_at timestamptz not null default now(),
  unique (property_id, category)
);

-- Room types (used for hostel beds; configurable)
create table if not exists room_types (
  id uuid primary key default uuid_generate_v4(),
  name text not null unique,
  monthly_rent numeric(12,2) not null check (monthly_rent > 0),
  created_at timestamptz not null default now()
);

-- Units: generic rentable unit (commercial shop/floor, house, or hostel bed)
create table if not exists units (
  id uuid primary key default uuid_generate_v4(),
  asset_id uuid not null references assets(id) on delete cascade,
  unit_type unit_type not null,
  name text not null,               -- "Ground Floor - Cakes n Bakes", "House 01", "Room 301 - Bed 2"
  floor text,                       -- floor label, e.g. "Ground Floor", "3rd Floor"
  room text,                        -- room label, e.g. "Room 301", null for commercial/houses
  room_type_id uuid references room_types(id), -- only for beds
  monthly_rent numeric(12,2) not null check (monthly_rent >= 0), -- for commercial/house; for beds mirrors room_type
  status unit_status not null default 'vacant',
  created_at timestamptz not null default now()
);

create index if not exists idx_units_asset on units(asset_id);

-- Tenants
create table if not exists tenants (
  id uuid primary key default uuid_generate_v4(),
  unit_id uuid references units(id) on delete set null,
  name text not null,
  phone text,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create index if not exists idx_tenants_unit on tenants(unit_id);

-- Rent payments (one row per payment recorded against a unit for a given month)
create table if not exists rent_payments (
  id uuid primary key default uuid_generate_v4(),
  unit_id uuid not null references units(id) on delete cascade,
  tenant_id uuid references tenants(id) on delete set null,
  rent_month date not null,          -- always stored as first-of-month
  amount numeric(12,2) not null check (amount > 0),
  payment_method payment_method not null,
  payment_date date not null default current_date,
  notes text,
  voided boolean not null default false,
  created_by uuid references profiles(id),
  created_at timestamptz not null default now(),
  updated_by uuid references profiles(id),
  updated_at timestamptz not null default now(),
  unique (unit_id, rent_month, id)
);

create index if not exists idx_rentpay_unit_month on rent_payments(unit_id, rent_month);

-- Income / Expense categories
create table if not exists income_categories (
  id uuid primary key default uuid_generate_v4(),
  name text not null unique
);

create table if not exists expense_categories (
  id uuid primary key default uuid_generate_v4(),
  name text not null unique
);

-- Income transactions (non-rent income)
create table if not exists income_transactions (
  id uuid primary key default uuid_generate_v4(),
  asset_id uuid not null references assets(id),
  category_id uuid not null references income_categories(id),
  amount numeric(12,2) not null check (amount > 0),
  payment_method payment_method not null,
  txn_date date not null default current_date,
  description text,
  voided boolean not null default false,
  created_by uuid references profiles(id),
  created_at timestamptz not null default now(),
  updated_by uuid references profiles(id),
  updated_at timestamptz not null default now()
);

-- Expense transactions
create table if not exists expense_transactions (
  id uuid primary key default uuid_generate_v4(),
  asset_id uuid not null references assets(id),
  category_id uuid not null references expense_categories(id),
  amount numeric(12,2) not null check (amount > 0),
  payment_method payment_method not null,
  txn_date date not null default current_date,
  paid_to text,
  description text,
  receipt_path text, -- Supabase Storage object path
  voided boolean not null default false,
  created_by uuid references profiles(id),
  created_at timestamptz not null default now(),
  updated_by uuid references profiles(id),
  updated_at timestamptz not null default now()
);

create index if not exists idx_income_asset_date on income_transactions(asset_id, txn_date);
create index if not exists idx_expense_asset_date on expense_transactions(asset_id, txn_date);

-- Settings (key/value)
create table if not exists settings (
  key text primary key,
  value text not null
);

insert into settings (key, value) values
  ('company_name', 'K&J CHESHTI PROPERTIES'),
  ('rent_due_day', '1'),
  ('grace_period_days', '5')
on conflict (key) do nothing;

-- Audit log (generic, for anything worth tracking beyond created_by/updated_by)
create table if not exists audit_logs (
  id uuid primary key default uuid_generate_v4(),
  table_name text not null,
  record_id uuid not null,
  action text not null, -- created / updated / voided
  actor uuid references profiles(id),
  details jsonb,
  created_at timestamptz not null default now()
);

-- ============================================================================
-- 3. AUDIT TRIGGER (generic, attached to the 3 transaction tables)
-- ============================================================================
create or replace function fn_audit_transaction() returns trigger as $$
begin
  if tg_op = 'INSERT' then
    insert into audit_logs(table_name, record_id, action, actor, details)
    values (tg_table_name, new.id, 'created', new.created_by, to_jsonb(new));
    return new;
  elsif tg_op = 'UPDATE' then
    if new.voided = true and old.voided = false then
      insert into audit_logs(table_name, record_id, action, actor, details)
      values (tg_table_name, new.id, 'voided', new.updated_by, to_jsonb(new));
    else
      insert into audit_logs(table_name, record_id, action, actor, details)
      values (tg_table_name, new.id, 'updated', new.updated_by, to_jsonb(new));
    end if;
    new.updated_at = now();
    return new;
  end if;
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists trg_audit_rent on rent_payments;
create trigger trg_audit_rent after insert or update on rent_payments
  for each row execute function fn_audit_transaction();

drop trigger if exists trg_audit_income on income_transactions;
create trigger trg_audit_income after insert or update on income_transactions
  for each row execute function fn_audit_transaction();

drop trigger if exists trg_audit_expense on expense_transactions;
create trigger trg_audit_expense after insert or update on expense_transactions
  for each row execute function fn_audit_transaction();

-- ============================================================================
-- 4. HELPER FUNCTIONS
-- ============================================================================

-- Returns true if the currently-authenticated user is an admin
create or replace function is_admin() returns boolean as $$
  select exists (
    select 1 from profiles where id = auth.uid() and role = 'admin'
  );
$$ language sql security definer stable;

-- Auto-create a profile row (role=staff by default) whenever a new auth user appears.
-- You will manually promote the admin account to role='admin' after creating it (see setup guide).
create or replace function fn_handle_new_user() returns trigger as $$
begin
  insert into profiles (id, email, full_name, role)
  values (new.id, new.email, coalesce(new.raw_user_meta_data->>'full_name', new.email), 'staff')
  on conflict (id) do nothing;
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists trg_new_user on auth.users;
create trigger trg_new_user after insert on auth.users
  for each row execute function fn_handle_new_user();

-- ============================================================================
-- 5. VIEWS — rent status for the CURRENT month
-- ============================================================================
create or replace view v_current_rent_status as
select
  u.id as unit_id,
  u.name as unit_name,
  u.unit_type,
  u.status as unit_status,
  u.monthly_rent,
  a.id as asset_id,
  a.name as asset_name,
  a.category,
  p.name as property_name,
  t.id as tenant_id,
  t.name as tenant_name,
  date_trunc('month', current_date)::date as rent_month,
  coalesce(sum(rp.amount) filter (
    where rp.rent_month = date_trunc('month', current_date)::date and rp.voided = false
  ), 0) as amount_received,
  case
    when u.status <> 'occupied' then 'VACANT'
    when coalesce(sum(rp.amount) filter (
      where rp.rent_month = date_trunc('month', current_date)::date and rp.voided = false
    ), 0) >= u.monthly_rent then 'PAID'
    when current_date <= (date_trunc('month', current_date)::date
         + ((select value::int from settings where key = 'rent_due_day') - 1) * interval '1 day'
         + (select value::int from settings where key = 'grace_period_days') * interval '1 day')
      then 'PENDING'
    else 'OVERDUE'
  end as rent_status
from units u
join assets a on a.id = u.asset_id
join properties p on p.id = a.property_id
left join tenants t on t.unit_id = u.id and t.is_active = true
left join rent_payments rp on rp.unit_id = u.id
group by u.id, u.name, u.unit_type, u.status, u.monthly_rent, a.id, a.name, a.category, p.name, t.id, t.name;

-- Asset-level summary (income, expenses, rent) — computed live, no stored totals
create or replace view v_asset_financials as
select
  a.id as asset_id,
  a.name as asset_name,
  p.name as property_name,
  a.category,
  coalesce((select sum(rp.amount) from rent_payments rp join units u2 on u2.id = rp.unit_id
            where u2.asset_id = a.id and rp.voided = false
            and rp.rent_month = date_trunc('month', current_date)::date), 0) as rent_received_this_month,
  coalesce((select sum(u.monthly_rent) from units u where u.asset_id = a.id and u.status = 'occupied'), 0) as expected_rent_this_month,
  coalesce((select sum(it.amount) from income_transactions it where it.asset_id = a.id and it.voided = false), 0) as total_other_income,
  coalesce((select sum(et.amount) from expense_transactions et where et.asset_id = a.id and et.voided = false), 0) as total_expenses
from assets a
join properties p on p.id = a.property_id;

-- ============================================================================
-- 6. ROW LEVEL SECURITY
-- ============================================================================
alter table profiles enable row level security;
alter table properties enable row level security;
alter table assets enable row level security;
alter table room_types enable row level security;
alter table units enable row level security;
alter table tenants enable row level security;
alter table rent_payments enable row level security;
alter table income_categories enable row level security;
alter table expense_categories enable row level security;
alter table income_transactions enable row level security;
alter table expense_transactions enable row level security;
alter table settings enable row level security;
alter table audit_logs enable row level security;

-- profiles: users can read their own profile; admins can read all
drop policy if exists p_profiles_select on profiles;
create policy p_profiles_select on profiles for select
  using (id = auth.uid() or is_admin());
drop policy if exists p_profiles_admin_update on profiles;
create policy p_profiles_admin_update on profiles for update
  using (is_admin());

-- Reference/config tables: any authenticated user can read; only admin can write
drop policy if exists p_properties_select on properties;
create policy p_properties_select on properties for select using (auth.role() = 'authenticated');
drop policy if exists p_properties_write on properties;
create policy p_properties_write on properties for all using (is_admin()) with check (is_admin());

drop policy if exists p_assets_select on assets;
create policy p_assets_select on assets for select using (auth.role() = 'authenticated');
drop policy if exists p_assets_write on assets;
create policy p_assets_write on assets for all using (is_admin()) with check (is_admin());

drop policy if exists p_roomtypes_select on room_types;
create policy p_roomtypes_select on room_types for select using (auth.role() = 'authenticated');
drop policy if exists p_roomtypes_write on room_types;
create policy p_roomtypes_write on room_types for all using (is_admin()) with check (is_admin());

drop policy if exists p_units_select on units;
create policy p_units_select on units for select using (auth.role() = 'authenticated');
drop policy if exists p_units_write on units;
create policy p_units_write on units for all using (is_admin()) with check (is_admin());

drop policy if exists p_tenants_select on tenants;
create policy p_tenants_select on tenants for select using (auth.role() = 'authenticated');
drop policy if exists p_tenants_insert on tenants;
create policy p_tenants_insert on tenants for insert with check (auth.role() = 'authenticated');
drop policy if exists p_tenants_update on tenants;
create policy p_tenants_update on tenants for update using (is_admin());

drop policy if exists p_inccat_select on income_categories;
create policy p_inccat_select on income_categories for select using (auth.role() = 'authenticated');
drop policy if exists p_inccat_write on income_categories;
create policy p_inccat_write on income_categories for all using (is_admin()) with check (is_admin());

drop policy if exists p_expcat_select on expense_categories;
create policy p_expcat_select on expense_categories for select using (auth.role() = 'authenticated');
drop policy if exists p_expcat_write on expense_categories;
create policy p_expcat_write on expense_categories for all using (is_admin()) with check (is_admin());

drop policy if exists p_settings_select on settings;
create policy p_settings_select on settings for select using (auth.role() = 'authenticated');
drop policy if exists p_settings_write on settings;
create policy p_settings_write on settings for all using (is_admin()) with check (is_admin());

-- Transaction tables: staff can insert (must stamp their own id); everyone authenticated can read;
-- only admin can update/void (staff cannot alter after submit, to protect audit integrity)
drop policy if exists p_rent_select on rent_payments;
create policy p_rent_select on rent_payments for select using (auth.role() = 'authenticated');
drop policy if exists p_rent_insert on rent_payments;
create policy p_rent_insert on rent_payments for insert with check (auth.role() = 'authenticated' and created_by = auth.uid());
drop policy if exists p_rent_update on rent_payments;
create policy p_rent_update on rent_payments for update using (is_admin());

drop policy if exists p_income_select on income_transactions;
create policy p_income_select on income_transactions for select using (auth.role() = 'authenticated');
drop policy if exists p_income_insert on income_transactions;
create policy p_income_insert on income_transactions for insert with check (auth.role() = 'authenticated' and created_by = auth.uid());
drop policy if exists p_income_update on income_transactions;
create policy p_income_update on income_transactions for update using (is_admin());

drop policy if exists p_expense_select on expense_transactions;
create policy p_expense_select on expense_transactions for select using (auth.role() = 'authenticated');
drop policy if exists p_expense_insert on expense_transactions;
create policy p_expense_insert on expense_transactions for insert with check (auth.role() = 'authenticated' and created_by = auth.uid());
drop policy if exists p_expense_update on expense_transactions;
create policy p_expense_update on expense_transactions for update using (is_admin());

-- Audit log: admin only
drop policy if exists p_audit_select on audit_logs;
create policy p_audit_select on audit_logs for select using (is_admin());

-- ============================================================================
-- 7. STORAGE BUCKET FOR RECEIPTS
-- ============================================================================
insert into storage.buckets (id, name, public)
values ('receipts', 'receipts', false)
on conflict (id) do nothing;

drop policy if exists "receipts_authenticated_read" on storage.objects;
create policy "receipts_authenticated_read" on storage.objects for select
  using (bucket_id = 'receipts' and auth.role() = 'authenticated');

drop policy if exists "receipts_authenticated_upload" on storage.objects;
create policy "receipts_authenticated_upload" on storage.objects for insert
  with check (bucket_id = 'receipts' and auth.role() = 'authenticated');

-- ============================================================================
-- 8. SEED DATA — properties, assets, room types, units
-- ============================================================================
insert into properties (name) values ('Barkat Market Heights') on conflict (name) do nothing;
insert into properties (name) values ('Shalimar Town Houses') on conflict (name) do nothing;

insert into assets (property_id, category, name)
select id, 'commercial', 'Barkat Market Heights (Commercial)' from properties where name = 'Barkat Market Heights'
on conflict (property_id, category) do nothing;

insert into assets (property_id, category, name)
select id, 'residential', 'Barkat Market Heights (Boys Hostel)' from properties where name = 'Barkat Market Heights'
on conflict (property_id, category) do nothing;

insert into assets (property_id, category, name)
select id, 'commercial', 'Shalimar Town Houses (Commercial)' from properties where name = 'Shalimar Town Houses'
on conflict (property_id, category) do nothing;

insert into assets (property_id, category, name)
select id, 'residential', 'Shalimar Town Houses (Residential)' from properties where name = 'Shalimar Town Houses'
on conflict (property_id, category) do nothing;

-- Room types for the hostel (bed counts per type are NOT assumed — configure via Admin > Settings)
insert into room_types (name, monthly_rent) values
  ('Type A', 22500),
  ('Type B', 25000),
  ('Type C', 55000)
on conflict (name) do nothing;

-- Commercial units: Barkat Market Heights
insert into units (asset_id, unit_type, name, floor, monthly_rent, status)
select a.id, 'commercial_unit', 'Ground Floor — Cakes n Bakes', 'Ground Floor', 600000, 'occupied'
from assets a join properties p on p.id = a.property_id
where p.name = 'Barkat Market Heights' and a.category = 'commercial'
and not exists (select 1 from units where name = 'Ground Floor — Cakes n Bakes');

insert into units (asset_id, unit_type, name, floor, monthly_rent, status)
select a.id, 'commercial_unit', '1st Floor — Gym', '1st Floor', 200000, 'occupied'
from assets a join properties p on p.id = a.property_id
where p.name = 'Barkat Market Heights' and a.category = 'commercial'
and not exists (select 1 from units where name = '1st Floor — Gym');

-- Commercial unit: Shalimar Town Houses shop
insert into units (asset_id, unit_type, name, floor, monthly_rent, status)
select a.id, 'commercial_unit', 'Commercial Shop', 'Ground Floor', 7000, 'occupied'
from assets a join properties p on p.id = a.property_id
where p.name = 'Shalimar Town Houses' and a.category = 'commercial'
and not exists (select 1 from units where name = 'Commercial Shop');

-- Residential houses: Shalimar Town Houses (12 houses)
insert into units (asset_id, unit_type, name, floor, monthly_rent, status)
select a.id, 'house', 'House 0' || g, 'Ground Floor', 42500, 'vacant'
from assets a join properties p on p.id = a.property_id, generate_series(1,6) g
where p.name = 'Shalimar Town Houses' and a.category = 'residential'
and not exists (select 1 from units where name = 'House 0' || g);

insert into units (asset_id, unit_type, name, floor, monthly_rent, status)
select a.id, 'house', 'House ' || (g+6), 'First Floor', 37500, 'vacant'
from assets a join properties p on p.id = a.property_id, generate_series(1,6) g
where p.name = 'Shalimar Town Houses' and a.category = 'residential'
and not exists (select 1 from units where name = 'House ' || (g+6));

-- NOTE ON HOSTEL BEDS (125 total, top 3 floors of Barkat Market Heights):
-- The exact floor/room/type distribution of the 125 beds was NOT provided,
-- so no bed rows are seeded here to avoid inventing data.
-- Configure floors/rooms/beds/room-types from Admin → Settings → Hostel Setup
-- after running this script (the app's admin UI writes directly into `units`
-- with unit_type='bed', floor, room, and room_type_id set).

-- ============================================================================
-- 9. EXPENSE CATEGORIES
-- ============================================================================
insert into expense_categories (name) values
  ('Electricity'),('Water'),('Gas'),('Maintenance'),('Cleaning Products'),
  ('Marketing'),('Wages'),('Taxes'),('Accountancy'),('Refreshments'),
  ('Equipment & Repairs'),('Office Stationery'),('Miscellaneous')
on conflict (name) do nothing;

-- ============================================================================
-- 10. INCOME CATEGORIES
-- ============================================================================
insert into income_categories (name) values
  ('Café / Refreshments'),('Commission'),('Late Fee'),('Miscellaneous')
on conflict (name) do nothing;

-- ============================================================================
-- DONE. Next step: create your two Auth users (see setup guide), then run:
--   update profiles set role = 'admin' where email = 'admin@yourdomain.com';
-- ============================================================================
