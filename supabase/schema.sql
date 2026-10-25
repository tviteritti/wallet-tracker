-- Wallet Tracker schema

create type public.asset_type as enum ('crypto', 'stock', 'cedear', 'bond', 'etf', 'fiat', 'other');
create type public.movement_type as enum ('buy', 'sell');

create table public.asset_groups (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  kind text not null check (kind in ('ibit')),
  cedear_ratio numeric(20, 8) not null default 10 check (cedear_ratio > 0),
  btc_per_share numeric(20, 12) not null default 0.000563914946 check (btc_per_share > 0),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.assets (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  symbol text not null,
  asset_type public.asset_type not null default 'other',
  currency text not null default 'USD' check (currency in ('USD', 'ARS')),
  current_price numeric(20, 8) not null default 0,
  notes text,
  group_id uuid references public.asset_groups(id) on delete cascade,
  venue text check (venue is null or venue in ('ars', 'mep', 'ccl')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.movements (
  id uuid primary key default gen_random_uuid(),
  asset_id uuid not null references public.assets(id) on delete cascade,
  movement_type public.movement_type not null,
  quantity numeric(20, 8) not null check (quantity > 0),
  price_per_unit numeric(20, 8) not null check (price_per_unit >= 0),
  fees numeric(20, 8) not null default 0 check (fees >= 0),
  traded_at timestamptz not null default now(),
  notes text,
  created_at timestamptz not null default now()
);

create table public.app_settings (
  id int primary key default 1 check (id = 1),
  usd_ars_rate numeric(20, 6) not null default 1000,
  updated_at timestamptz not null default now()
);

create table public.daily_fx_rates (
  rate_date date primary key,
  usd_ars_rate numeric(20, 6) not null check (usd_ars_rate > 0),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

insert into public.app_settings (id, usd_ars_rate) values (1, 1000)
on conflict (id) do nothing;

create index movements_asset_id_idx on public.movements(asset_id);
create index movements_traded_at_idx on public.movements(traded_at desc);
create index assets_group_id_idx on public.assets(group_id);
create unique index assets_group_venue_uidx on public.assets(group_id, venue) where venue is not null;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger assets_set_updated_at
before update on public.assets
for each row
execute function public.set_updated_at();

create trigger asset_groups_set_updated_at
before update on public.asset_groups
for each row
execute function public.set_updated_at();

create trigger app_settings_set_updated_at
before update on public.app_settings
for each row
execute function public.set_updated_at();

create trigger daily_fx_rates_set_updated_at
before update on public.daily_fx_rates
for each row
execute function public.set_updated_at();

alter table public.assets enable row level security;
alter table public.movements enable row level security;
alter table public.app_settings enable row level security;
alter table public.daily_fx_rates enable row level security;
alter table public.asset_groups enable row level security;

create policy "Authenticated full access assets" on public.assets
  for all to authenticated
  using (true) with check (true);

create policy "Authenticated full access asset_groups" on public.asset_groups
  for all to authenticated
  using (true) with check (true);

create policy "Authenticated full access movements" on public.movements
  for all to authenticated
  using (true) with check (true);

create policy "Authenticated full access settings" on public.app_settings
  for all to authenticated
  using (true) with check (true);

create policy "Authenticated full access daily_fx_rates" on public.daily_fx_rates
  for all to authenticated
  using (true) with check (true);

insert into public.asset_groups (name, kind, cedear_ratio, btc_per_share, notes)
select
  'IBIT',
  'ibit',
  10,
  0.000563914946,
  'CEDEAR de iShares Bitcoin Trust. 10 certificados = 1 acción del ETF. Plazas separadas: pesos (IBIT), MEP (IBITD) y CCL (IBITC).'
where not exists (select 1 from public.asset_groups where kind = 'ibit');

insert into public.assets (name, symbol, asset_type, currency, current_price, notes, group_id, venue)
select 'iShares Bitcoin Trust', 'IBIT', 'cedear', 'ARS', 0, 'Plaza en pesos.', g.id, 'ars'
from public.asset_groups g
where g.kind = 'ibit'
  and not exists (select 1 from public.assets a where a.group_id = g.id and a.venue = 'ars');

insert into public.assets (name, symbol, asset_type, currency, current_price, notes, group_id, venue)
select 'iShares Bitcoin Trust', 'IBITD', 'cedear', 'USD', 0, 'Plaza en dólar MEP.', g.id, 'mep'
from public.asset_groups g
where g.kind = 'ibit'
  and not exists (select 1 from public.assets a where a.group_id = g.id and a.venue = 'mep');

insert into public.assets (name, symbol, asset_type, currency, current_price, notes, group_id, venue)
select 'iShares Bitcoin Trust', 'IBITC', 'cedear', 'USD', 0, 'Plaza en dólar CCL.', g.id, 'ccl'
from public.asset_groups g
where g.kind = 'ibit'
  and not exists (select 1 from public.assets a where a.group_id = g.id and a.venue = 'ccl');
