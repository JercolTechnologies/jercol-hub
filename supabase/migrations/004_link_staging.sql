-- ======================================================================
-- 004_link_staging.sql
-- ======================================================================
-- Link de preview por tarjeta. Va en tabla aparte (ticket_staging) y no
-- como columna de tickets porque RLS filtra filas, no columnas: como
-- columna el link viajaría al cliente aunque la interfaz lo escondiera.
-- ======================================================================

create table if not exists ticket_staging (
  ticket_id uuid primary key references tickets(id) on delete cascade,
  url text not null,
  updated_by uuid references profiles(id) on delete set null,
  updated_at timestamptz not null default now()
);
alter table ticket_staging enable row level security;

-- Solo el admin escribe y puede leer siempre
drop policy if exists "staging_admin_all" on ticket_staging;
create policy "staging_admin_all" on ticket_staging for all
  using (public.is_admin()) with check (public.is_admin());

-- El cliente solo puede LEER, y solo cuando la tarjeta ya llegó a revisión.
-- Esto es lo que hace que el link sea invisible antes de tiempo incluso
-- llamando la API directamente: no es un ocultamiento de interfaz.
drop policy if exists "staging_select_client_when_ready" on ticket_staging;
create policy "staging_select_client_when_ready" on ticket_staging for select using (
  exists (
    select 1
    from tickets t
    join projects p on p.id = t.project_id
    where t.id = ticket_staging.ticket_id
      and p.client_id = public.my_client_id()
      and t.status in ('en_revision', 'hecho')
  )
);

alter publication supabase_realtime add table ticket_staging;
