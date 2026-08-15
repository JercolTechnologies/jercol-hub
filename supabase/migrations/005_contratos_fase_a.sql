-- ======================================================================
-- 005_contratos_fase_a.sql
-- ======================================================================
-- Contratos, fase A (sin firma): contactos del cliente, estado del
-- proyecto, contratos con versiones, relación N:M con proyectos,
-- comentarios, otrosíes con evidencia y bucket privado de contratos.
-- ======================================================================

-- ---------- Contactos del cliente (no son cuentas de la app) ----------
create table if not exists client_contacts (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references clients(id) on delete cascade,
  full_name text not null,
  phone text,
  email text,
  role_label text,
  is_legal_rep boolean not null default false,
  created_at timestamptz not null default now()
);
alter table client_contacts enable row level security;

drop policy if exists "contacts_admin_all" on client_contacts;
create policy "contacts_admin_all" on client_contacts for all
  using (public.is_admin()) with check (public.is_admin());
drop policy if exists "contacts_select_own" on client_contacts;
create policy "contacts_select_own" on client_contacts for select
  using (client_id = public.my_client_id());

-- ---------- Estado del proyecto ----------
alter table projects add column if not exists status text not null default 'activo'
  check (status in ('activo','terminado'));
alter table projects add column if not exists finished_at timestamptz;

-- ---------- Contratos ----------
create table if not exists contracts (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references clients(id) on delete cascade,
  title text not null,
  status text not null default 'borrador'
    check (status in ('borrador','en_revision','aprobado','firmado_jercol','vigente','anulado')),
  signer_contact_id uuid references client_contacts(id) on delete set null,
  poder_path text,
  created_by uuid references profiles(id) on delete set null,
  created_at timestamptz not null default now()
);
alter table contracts enable row level security;

drop policy if exists "contracts_admin_all" on contracts;
create policy "contracts_admin_all" on contracts for all
  using (public.is_admin()) with check (public.is_admin());

-- El cliente no ve los borradores: solo desde que se publica para revisión
drop policy if exists "contracts_select_own_published" on contracts;
create policy "contracts_select_own_published" on contracts for select using (
  client_id = public.my_client_id() and status <> 'borrador'
);
-- El cliente solo puede cambiar el estado a 'aprobado' (dar el visto bueno)
drop policy if exists "contracts_update_own_approve" on contracts;
create policy "contracts_update_own_approve" on contracts for update
  using (client_id = public.my_client_id() and status = 'en_revision')
  with check (client_id = public.my_client_id() and status = 'aprobado');

-- ---------- Relación N:M con proyectos ----------
create table if not exists contract_projects (
  contract_id uuid not null references contracts(id) on delete cascade,
  project_id uuid not null references projects(id) on delete cascade,
  primary key (contract_id, project_id)
);
alter table contract_projects enable row level security;

drop policy if exists "cproj_admin_all" on contract_projects;
create policy "cproj_admin_all" on contract_projects for all
  using (public.is_admin()) with check (public.is_admin());
drop policy if exists "cproj_select_own" on contract_projects;
create policy "cproj_select_own" on contract_projects for select using (
  exists (select 1 from projects p where p.id = contract_projects.project_id
          and p.client_id = public.my_client_id())
);

-- ---------- Versiones del PDF ----------
create table if not exists contract_versions (
  id uuid primary key default gen_random_uuid(),
  contract_id uuid not null references contracts(id) on delete cascade,
  version_number int not null,
  storage_path text not null,
  file_name text not null,
  size_bytes bigint,
  notes text,
  uploaded_by uuid references profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (contract_id, version_number)
);
alter table contract_versions enable row level security;

drop policy if exists "cver_admin_all" on contract_versions;
create policy "cver_admin_all" on contract_versions for all
  using (public.is_admin()) with check (public.is_admin());
drop policy if exists "cver_select_own" on contract_versions;
create policy "cver_select_own" on contract_versions for select using (
  exists (select 1 from contracts c where c.id = contract_versions.contract_id
          and c.client_id = public.my_client_id() and c.status <> 'borrador')
);

-- ---------- Hilo de comentarios del contrato ----------
create table if not exists contract_comments (
  id uuid primary key default gen_random_uuid(),
  contract_id uuid not null references contracts(id) on delete cascade,
  author_id uuid references profiles(id) on delete set null,
  body text not null,
  created_at timestamptz not null default now()
);
alter table contract_comments enable row level security;

drop policy if exists "ccom_admin_all" on contract_comments;
create policy "ccom_admin_all" on contract_comments for all
  using (public.is_admin()) with check (public.is_admin());
drop policy if exists "ccom_select_own" on contract_comments;
create policy "ccom_select_own" on contract_comments for select using (
  exists (select 1 from contracts c where c.id = contract_comments.contract_id
          and c.client_id = public.my_client_id() and c.status <> 'borrador')
);
drop policy if exists "ccom_insert_own" on contract_comments;
create policy "ccom_insert_own" on contract_comments for insert with check (
  author_id = auth.uid()
  and exists (select 1 from contracts c where c.id = contract_comments.contract_id
              and c.client_id = public.my_client_id() and c.status <> 'borrador')
);

-- ---------- Otrosíes / adendas (evidencia de acuerdos por WhatsApp o correo) ----------
create table if not exists contract_addenda (
  id uuid primary key default gen_random_uuid(),
  contract_id uuid not null references contracts(id) on delete cascade,
  agreed_on date not null,
  channel text not null default 'whatsapp' check (channel in ('whatsapp','correo','llamada','otro')),
  counterpart text,
  body text not null,
  evidence_path text,
  created_by uuid references profiles(id) on delete set null,
  created_at timestamptz not null default now()
);
alter table contract_addenda enable row level security;

drop policy if exists "cadd_admin_all" on contract_addenda;
create policy "cadd_admin_all" on contract_addenda for all
  using (public.is_admin()) with check (public.is_admin());
drop policy if exists "cadd_select_own" on contract_addenda;
create policy "cadd_select_own" on contract_addenda for select using (
  exists (select 1 from contracts c where c.id = contract_addenda.contract_id
          and c.client_id = public.my_client_id() and c.status <> 'borrador')
);

-- ---------- Bucket privado de contratos ----------
insert into storage.buckets (id, name, public)
values ('contracts', 'contracts', false)
on conflict (id) do nothing;

drop policy if exists "storage_contracts_select" on storage.objects;
create policy "storage_contracts_select" on storage.objects for select
  using (
    bucket_id = 'contracts'
    and (
      public.is_admin()
      or exists (select 1 from contracts c
                 where c.id::text = (storage.foldername(name))[1]
                   and c.client_id = public.my_client_id()
                   and c.status <> 'borrador')
    )
  );

drop policy if exists "storage_contracts_insert" on storage.objects;
create policy "storage_contracts_insert" on storage.objects for insert
  with check (bucket_id = 'contracts' and public.is_admin());

drop policy if exists "storage_contracts_delete" on storage.objects;
create policy "storage_contracts_delete" on storage.objects for delete
  using (bucket_id = 'contracts' and public.is_admin());

-- ---------- Realtime ----------
alter publication supabase_realtime add table client_contacts, contracts, contract_versions, contract_comments, contract_addenda;
