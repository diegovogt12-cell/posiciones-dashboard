-- ============================================================
-- Schema: posiciones DVV Monex
-- Ejecutar en: Supabase Dashboard → SQL Editor → New query → Run
-- ============================================================

-- Tabla principal
create table if not exists public.positions (
  id          uuid primary key default gen_random_uuid(),
  fecha       date not null,
  tipo        text not null check (tipo in ('equity','call','put','futuro','forward')),
  ticker      text not null,
  posicion    numeric not null,
  precio      numeric not null check (precio >= 0),
  strike      numeric check (strike is null or strike > 0),
  venc_mes    text check (venc_mes in ('MAR','JUN','SEP','DIC')),
  venc_anio   integer,
  venc_fecha  date,
  created_by  uuid references auth.users(id) on delete set null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- Índices útiles
create index if not exists positions_ticker_idx on public.positions(ticker);
create index if not exists positions_fecha_idx  on public.positions(fecha desc);
create index if not exists positions_tipo_idx   on public.positions(tipo);

-- Trigger para mantener updated_at
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

drop trigger if exists positions_set_updated_at on public.positions;
create trigger positions_set_updated_at
  before update on public.positions
  for each row execute function public.set_updated_at();

-- ============================================================
-- Row Level Security: todos los usuarios autenticados ven y
-- modifican la misma tabla compartida (modelo "equipo DVV").
-- ============================================================
alter table public.positions enable row level security;

-- SELECT: cualquier usuario autenticado ve todas las posiciones
drop policy if exists "dvv_select_all" on public.positions;
create policy "dvv_select_all"
  on public.positions for select
  to authenticated
  using (true);

-- INSERT: cualquier autenticado puede insertar (created_by = su uid)
drop policy if exists "dvv_insert_any" on public.positions;
create policy "dvv_insert_any"
  on public.positions for insert
  to authenticated
  with check (auth.uid() = created_by);

-- UPDATE: cualquier autenticado puede editar cualquier fila
drop policy if exists "dvv_update_any" on public.positions;
create policy "dvv_update_any"
  on public.positions for update
  to authenticated
  using (true)
  with check (true);

-- DELETE: cualquier autenticado puede borrar cualquier fila
drop policy if exists "dvv_delete_any" on public.positions;
create policy "dvv_delete_any"
  on public.positions for delete
  to authenticated
  using (true);
