-- Wallet Tracker schema (ya aplicado en el proyecto Supabase WalletTracker)

create type public.asset_type as enum ('crypto', 'stock', 'cedear', 'bond', 'etf', 'other');
create type public.movement_type as enum ('buy', 'sell');

create table public.assets (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  symbol text not null,
  asset_type public.asset_type not null default 'other',
  currency text not null default 'USD',
  current_price numeric(20, 8) not null default 0,
  notes text,
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

create index movements_asset_id_idx on public.movements(asset_id);
create index movements_traded_at_idx on public.movements(traded_at desc);

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

alter table public.assets enable row level security;
alter table public.movements enable row level security;

create policy "Authenticated full access assets" on public.assets
  for all to authenticated
  using (true) with check (true);

create policy "Authenticated full access movements" on public.movements
  for all to authenticated
  using (true) with check (true);
