-- ======================================================================
-- 002_estados_fechas_adjuntos_ideas.sql
-- ======================================================================
-- Renombra en_progreso -> en_desarrollo. Agrega fecha deseada, marca de
-- actividad para el indicador de no leído, archivar clientes, adjuntos de
-- tickets, ideas de proyecto, y el trigger enforce_ticket_rules que aplica
-- la máquina de estados del lado de la base de datos.
-- ======================================================================

-- 1. Renombrar estado en_progreso -> en_desarrollo
alter table tickets drop constraint if exists tickets_status_check;
update tickets set status = 'en_desarrollo' where status = 'en_progreso';
alter table tickets add constraint tickets_status_check
  check (status in ('solicitudes','backlog','en_desarrollo','en_revision','hecho'));

-- 2. Fecha deseada (informativa, no es un compromiso)
alter table tickets add column if not exists date_preset text
  check (date_preset in ('esta_semana','proximas_2_semanas','este_mes','sin_prisa'));
alter table tickets add column if not exists desired_date date;

-- 3. Actividad reciente (para el indicador de "tienes feedback nuevo")
alter table tickets add column if not exists last_activity_at timestamptz not null default now();

create or replace function public.bump_ticket_activity()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  update public.tickets set last_activity_at = now() where id = new.ticket_id;
  return new;
end;
$$;

drop trigger if exists on_comment_bump_activity on comments;
create trigger on_comment_bump_activity
  after insert on comments
  for each row execute procedure public.bump_ticket_activity();

-- 4. Última vez que cada usuario vio cada tarjeta
create table if not exists ticket_reads (
  ticket_id uuid not null references tickets(id) on delete cascade,
  user_id uuid not null references profiles(id) on delete cascade,
  last_seen_at timestamptz not null default now(),
  primary key (ticket_id, user_id)
);
alter table ticket_reads enable row level security;
drop policy if exists "ticket_reads_own" on ticket_reads;
create policy "ticket_reads_own" on ticket_reads for all
  using (user_id = auth.uid()) with check (user_id = auth.uid());
drop policy if exists "ticket_reads_admin_select" on ticket_reads;
create policy "ticket_reads_admin_select" on ticket_reads for select using (public.is_admin());

-- 5. Archivar clientes en vez de borrarlos
alter table clients add column if not exists archived boolean not null default false;

-- 6. Máquina de estados: qué puede tocar un cliente y cuándo (el resto lo controla el trigger)
create or replace function public.enforce_ticket_rules()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  if public.is_admin() then
    return new;
  end if;

  if old.status not in ('solicitudes', 'en_revision') then
    raise exception 'No tienes permiso para modificar esta tarjeta en su estado actual.';
  end if;

  if new.status <> old.status then
    if not (old.status = 'en_revision' and new.status = 'hecho') then
      raise exception 'Ese cambio de estado no está permitido.';
    end if;
  end if;

  if new.project_id <> old.project_id or new.created_by is distinct from old.created_by then
    raise exception 'No tienes permiso para modificar estos campos.';
  end if;

  return new;
end;
$$;

drop trigger if exists on_ticket_update_enforce_rules on tickets;
create trigger on_ticket_update_enforce_rules
  before update on tickets
  for each row execute procedure public.enforce_ticket_rules();

-- La política RLS de UPDATE queda simple (solo aísla por cliente); las reglas finas las aplica el trigger de arriba
drop policy if exists "tickets_update_own_project" on tickets;
create policy "tickets_update_own_project" on tickets for update
  using (exists (select 1 from projects p where p.id = tickets.project_id and p.client_id = public.my_client_id()))
  with check (exists (select 1 from projects p where p.id = tickets.project_id and p.client_id = public.my_client_id()));

-- Insertar: el cliente solo crea en "solicitudes" y como autor real
drop policy if exists "tickets_insert_own_project" on tickets;
create policy "tickets_insert_own_project" on tickets for insert
  with check (
    exists (select 1 from projects p where p.id = tickets.project_id and p.client_id = public.my_client_id())
    and status = 'solicitudes'
    and created_by = auth.uid()
  );

-- El cliente ya no puede borrar tickets en ningún estado
drop policy if exists "tickets_delete_own" on tickets;

-- 7. Archivos adjuntos
create table if not exists attachments (
  id uuid primary key default gen_random_uuid(),
  ticket_id uuid not null references tickets(id) on delete cascade,
  uploaded_by uuid references profiles(id) on delete set null,
  storage_path text not null,
  file_name text not null,
  size_bytes bigint,
  content_type text,
  created_at timestamptz not null default now()
);
alter table attachments enable row level security;

drop policy if exists "attachments_admin_all" on attachments;
create policy "attachments_admin_all" on attachments for all
  using (public.is_admin()) with check (public.is_admin());
drop policy if exists "attachments_select_own_project" on attachments;
create policy "attachments_select_own_project" on attachments for select using (
  exists (select 1 from tickets t join projects p on p.id = t.project_id
          where t.id = attachments.ticket_id and p.client_id = public.my_client_id())
);
drop policy if exists "attachments_insert_own_project" on attachments;
create policy "attachments_insert_own_project" on attachments for insert with check (
  exists (select 1 from tickets t join projects p on p.id = t.project_id
          where t.id = attachments.ticket_id and p.client_id = public.my_client_id())
  and uploaded_by = auth.uid()
);
drop policy if exists "attachments_delete_own" on attachments;
create policy "attachments_delete_own" on attachments for delete using (uploaded_by = auth.uid());

-- Bucket de Storage privado para los archivos
insert into storage.buckets (id, name, public)
values ('ticket-attachments', 'ticket-attachments', false)
on conflict (id) do nothing;

drop policy if exists "storage_attachments_select" on storage.objects;
create policy "storage_attachments_select" on storage.objects for select
  using (
    bucket_id = 'ticket-attachments'
    and (
      public.is_admin()
      or exists (select 1 from tickets t join projects p on p.id = t.project_id
                 where t.id::text = (storage.foldername(name))[1] and p.client_id = public.my_client_id())
    )
  );

drop policy if exists "storage_attachments_insert" on storage.objects;
create policy "storage_attachments_insert" on storage.objects for insert
  with check (
    bucket_id = 'ticket-attachments'
    and (
      public.is_admin()
      or exists (select 1 from tickets t join projects p on p.id = t.project_id
                 where t.id::text = (storage.foldername(name))[1] and p.client_id = public.my_client_id())
    )
  );

drop policy if exists "storage_attachments_delete" on storage.objects;
create policy "storage_attachments_delete" on storage.objects for delete
  using (bucket_id = 'ticket-attachments' and (public.is_admin() or owner = auth.uid()));

-- 8. Ideas de proyecto (aparte del tablero de tickets)
create table if not exists project_ideas (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references clients(id) on delete cascade,
  title text not null,
  description text default '',
  status text not null default 'nueva' check (status in ('nueva','en_conversacion','convertida','descartada')),
  created_by uuid references profiles(id) on delete set null,
  created_at timestamptz not null default now()
);
alter table project_ideas enable row level security;

drop policy if exists "ideas_admin_all" on project_ideas;
create policy "ideas_admin_all" on project_ideas for all
  using (public.is_admin()) with check (public.is_admin());
drop policy if exists "ideas_select_own_client" on project_ideas;
create policy "ideas_select_own_client" on project_ideas for select using (client_id = public.my_client_id());
drop policy if exists "ideas_insert_own_client" on project_ideas;
create policy "ideas_insert_own_client" on project_ideas for insert
  with check (client_id = public.my_client_id() and created_by = auth.uid());
drop policy if exists "ideas_update_own_client" on project_ideas;
create policy "ideas_update_own_client" on project_ideas for update
  using (client_id = public.my_client_id() and status = 'nueva')
  with check (client_id = public.my_client_id() and status = 'nueva');

create table if not exists project_idea_comments (
  id uuid primary key default gen_random_uuid(),
  idea_id uuid not null references project_ideas(id) on delete cascade,
  author_id uuid references profiles(id) on delete set null,
  body text not null,
  created_at timestamptz not null default now()
);
alter table project_idea_comments enable row level security;

drop policy if exists "idea_comments_admin_all" on project_idea_comments;
create policy "idea_comments_admin_all" on project_idea_comments for all
  using (public.is_admin()) with check (public.is_admin());
drop policy if exists "idea_comments_select_own_client" on project_idea_comments;
create policy "idea_comments_select_own_client" on project_idea_comments for select using (
  exists (select 1 from project_ideas i where i.id = project_idea_comments.idea_id and i.client_id = public.my_client_id())
);
drop policy if exists "idea_comments_insert_own_client" on project_idea_comments;
create policy "idea_comments_insert_own_client" on project_idea_comments for insert with check (
  exists (select 1 from project_ideas i where i.id = project_idea_comments.idea_id and i.client_id = public.my_client_id())
  and author_id = auth.uid()
);

-- 9. Realtime para las tablas nuevas
alter publication supabase_realtime add table ticket_reads, attachments, project_ideas, project_idea_comments;
