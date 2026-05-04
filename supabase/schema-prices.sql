-- ============================================================
-- Schema: precios de cierre para valuación MTM
-- Ejecutar en Supabase Dashboard → SQL Editor (o vía
-- node scripts/run-schema.mjs supabase/schema-prices.sql).
-- ============================================================

create table if not exists public.prices (
  id           uuid primary key default gen_random_uuid(),
  fecha        date    not null,                          -- fecha de cierre
  tipo         text    not null check (tipo in ('equity','call','put','futuro','forward')),
  ticker       text    not null,
  strike       numeric check (strike is null or strike > 0),
  venc_mes     text    check (venc_mes in ('MAR','JUN','SEP','DIC')),
  venc_anio    integer,
  venc_fecha   date,
  precio       numeric not null check (precio > 0),
  uploaded_by  uuid    references auth.users(id) on delete set null,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

-- Un precio único por (fecha, instrumento). Postgres trata NULLs como
-- iguales con NULLS NOT DISTINCT (Postgres 15+, soportado en Supabase).
create unique index if not exists prices_unique_idx on public.prices (
  fecha, tipo, ticker, strike, venc_mes, venc_anio, venc_fecha
) nulls not distinct;

create index if not exists prices_fecha_idx  on public.prices(fecha desc);
create index if not exists prices_ticker_idx on public.prices(ticker);

-- Trigger updated_at
create or replace function public.set_prices_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

drop trigger if exists prices_set_updated_at on public.prices;
create trigger prices_set_updated_at
  before update on public.prices
  for each row execute function public.set_prices_updated_at();

-- RLS: igual que positions — todos los autenticados ven y modifican.
alter table public.prices enable row level security;

drop policy if exists "dvv_prices_select" on public.prices;
create policy "dvv_prices_select"
  on public.prices for select to authenticated using (true);

drop policy if exists "dvv_prices_insert" on public.prices;
create policy "dvv_prices_insert"
  on public.prices for insert to authenticated
  with check (auth.uid() = uploaded_by);

drop policy if exists "dvv_prices_update" on public.prices;
create policy "dvv_prices_update"
  on public.prices for update to authenticated
  using (true) with check (true);

drop policy if exists "dvv_prices_delete" on public.prices;
create policy "dvv_prices_delete"
  on public.prices for delete to authenticated using (true);
