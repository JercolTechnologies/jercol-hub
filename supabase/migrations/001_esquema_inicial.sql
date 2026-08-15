-- ======================================================================
-- 001_esquema_inicial.sql
-- ======================================================================
-- Esquema base: clients, profiles, projects, tickets, comments.
-- Incluye el trigger que crea el perfil al registrarse y las funciones
-- helper is_admin() / my_client_id() usadas por todas las políticas RLS.
-- 
-- OJO: empieza con DROP TABLE. Solo debe correrse en una base vacía o
-- cuando quieras reiniciar todo desde cero.
-- ======================================================================

drop table if exists comments cascade;
drop table if exists tickets cascade;
drop table if exists projects cascade;
drop table if exists profiles cascade;
drop table if exists clients cascade;

create extension if not exists pgcrypto;

-- ---------- Tablas ----------

create table clients (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_at timestamptz not null default now()
);

create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  email text,
  role text not null default 'client' check (role in ('admin','client')),
  client_id uuid references clients(id) on delete set null,
  created_at timestamptz not null default now()
);

create table projects (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references clients(id) on delete cascade,
  name text not null,
  created_at timestamptz not null default now()
);

create table tickets (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  title text not null,
  description text default '',
  type text not null default 'feature' check (type in ('feature','bug','mejora')),
  priority text not null default 'media' check (priority in ('baja','media','alta')),
  status text not null default 'solicitudes' check (status in ('solicitudes','backlog','en_progreso','en_revision','hecho')),
  created_by uuid references profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

create table comments (
  id uuid primary key default gen_random_uuid(),
  ticket_id uuid not null references tickets(id) on delete cascade,
  author_id uuid references profiles(id) on delete set null,
  body text not null,
  created_at timestamptz not null default now()
);

-- ---------- Crear profile automático al registrarse ----------

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, full_name, email)
  values (new.id, new.raw_user_meta_data->>'full_name', new.email);
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- ---------- Funciones helper para RLS (evitan recursión) ----------

create or replace function public.is_admin()
returns boolean
language sql security definer set search_path = public stable
as $$
  select exists (select 1 from public.profiles where id = auth.uid() and role = 'admin');
$$;

create or replace function public.my_client_id()
returns uuid
language sql security definer set search_path = public stable
as $$
  select client_id from public.profiles where id = auth.uid();
$$;

-- ---------- RLS ----------

alter table clients enable row level security;
alter table profiles enable row level security;
alter table projects enable row level security;
alter table tickets enable row level security;
alter table comments enable row level security;

-- profiles
create policy "profiles_select_own" on profiles for select using (id = auth.uid());
create policy "profiles_select_admin" on profiles for select using (public.is_admin());
create policy "profiles_select_same_client" on profiles for select using (
  client_id is not null and client_id = public.my_client_id()
);
create policy "profiles_update_admin" on profiles for update using (public.is_admin());
create policy "profiles_update_own_name" on profiles for update using (id = auth.uid()) with check (id = auth.uid());

-- clients
create policy "clients_admin_all" on clients for all using (public.is_admin()) with check (public.is_admin());
create policy "clients_select_own" on clients for select using (id = public.my_client_id());

-- projects
create policy "projects_admin_all" on projects for all using (public.is_admin()) with check (public.is_admin());
create policy "projects_select_own_client" on projects for select using (client_id = public.my_client_id());

-- tickets
create policy "tickets_admin_all" on tickets for all using (public.is_admin()) with check (public.is_admin());
create policy "tickets_select_own_project" on tickets for select using (
  exists (select 1 from projects p where p.id = tickets.project_id and p.client_id = public.my_client_id())
);
create policy "tickets_insert_own_project" on tickets for insert with check (
  exists (select 1 from projects p where p.id = tickets.project_id and p.client_id = public.my_client_id())
);
create policy "tickets_update_own_project" on tickets for update using (
  exists (select 1 from projects p where p.id = tickets.project_id and p.client_id = public.my_client_id())
) with check (
  exists (select 1 from projects p where p.id = tickets.project_id and p.client_id = public.my_client_id())
);
create policy "tickets_delete_own" on tickets for delete using (created_by = auth.uid());

-- comments
create policy "comments_admin_all" on comments for all using (public.is_admin()) with check (public.is_admin());
create policy "comments_select_own_project" on comments for select using (
  exists (
    select 1 from tickets t join projects p on p.id = t.project_id
    where t.id = comments.ticket_id and p.client_id = public.my_client_id()
  )
);
create policy "comments_insert_own_project" on comments for insert with check (
  exists (
    select 1 from tickets t join projects p on p.id = t.project_id
    where t.id = comments.ticket_id and p.client_id = public.my_client_id()
  )
);
create policy "comments_delete_own" on comments for delete using (author_id = auth.uid());

-- ---------- Realtime ----------
alter publication supabase_realtime add table clients, profiles, projects, tickets, comments;
