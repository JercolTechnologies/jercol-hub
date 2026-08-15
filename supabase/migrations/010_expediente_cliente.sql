-- ======================================================================
-- 010_expediente_cliente.sql
-- ======================================================================
-- Cambia el alta de clientes: en vez de que Jercol los cree a mano, el
-- cliente se registra con todos sus datos y documentos, y Jercol solo
-- revisa y verifica.
--
-- Por qué importa la verificación: el certificado de firma prueba que una
-- cuenta firmó. Para poder sostener que firmó el representante legal hace
-- falta haber cotejado antes su documento contra el RUT. Eso es lo que
-- queda registrado aquí, con fecha y quién lo hizo.
-- ======================================================================


-- ---------- Datos de la empresa o persona ----------
alter table clients add column if not exists kind text not null default 'juridica'
  check (kind in ('juridica','natural'));

-- Documento fiscal: NIT si es empresa, cédula si es persona natural.
-- Es la llave que impide registrar dos veces al mismo cliente.
alter table clients add column if not exists tax_id text;
alter table clients add column if not exists address text;
alter table clients add column if not exists city text;
alter table clients add column if not exists phone text;

create unique index if not exists clients_tax_id_key on clients (tax_id) where tax_id is not null;

-- ---------- Verificación ----------
alter table clients add column if not exists status text not null default 'verificado'
  check (status in ('pendiente','verificado','rechazado'));
alter table clients add column if not exists rejection_reason text;
alter table clients add column if not exists verified_at timestamptz;
alter table clients add column if not exists verified_by uuid references profiles(id) on delete set null;
alter table clients add column if not exists data_consent_at timestamptz;
alter table clients add column if not exists registered_by uuid references profiles(id) on delete set null;

-- Los clientes que ya existían quedan como verificados: se crearon a mano
-- por Jercol, así que no tiene sentido pedirles expediente retroactivo.

-- El cliente puede crear su propia ficha al registrarse. Solo eso: los
-- cambios posteriores y la verificación son del admin.
drop policy if exists "clients_insert_registro" on clients;
create policy "clients_insert_registro" on clients for insert
  with check (registered_by = auth.uid() and status = 'pendiente');


-- ---------- Documentos del expediente ----------
create table if not exists client_documents (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references clients(id) on delete cascade,
  kind text not null check (kind in ('rut','cedula','camara','otro')),
  storage_path text not null,
  file_name text not null,
  size_bytes bigint,
  uploaded_by uuid references profiles(id) on delete set null,
  created_at timestamptz not null default now()
);
alter table client_documents enable row level security;

drop policy if exists "cdoc_admin_all" on client_documents;
create policy "cdoc_admin_all" on client_documents for all
  using (public.is_admin()) with check (public.is_admin());

drop policy if exists "cdoc_select_own" on client_documents;
create policy "cdoc_select_own" on client_documents for select
  using (client_id = public.my_client_id());

-- Al registrarse todavía no es "miembro activo", así que la condición mira
-- quién registró la empresa, no my_client_id().
drop policy if exists "cdoc_insert_registro" on client_documents;
create policy "cdoc_insert_registro" on client_documents for insert with check (
  uploaded_by = auth.uid()
  and exists (select 1 from clients c where c.id = client_documents.client_id
              and c.registered_by = auth.uid())
);


-- ---------- Miembros del equipo del cliente ----------
alter table profiles add column if not exists member_status text not null default 'activo'
  check (member_status in ('pendiente','activo','rechazado'));
alter table profiles add column if not exists is_owner boolean not null default false;
alter table profiles add column if not exists job_title text;

-- Quien pide unirse a una empresa lo hace sobre su propia fila.
drop policy if exists "profiles_update_own_name" on profiles;
create policy "profiles_update_own" on profiles for update
  using (id = auth.uid()) with check (id = auth.uid());

-- El responsable de una empresa puede aprobar o rechazar a los suyos.
drop policy if exists "profiles_update_owner" on profiles;
create policy "profiles_update_owner" on profiles for update using (
  client_id is not null
  and client_id = (select p.client_id from profiles p where p.id = auth.uid() and p.is_owner)
);


-- ---------- Un miembro pendiente todavía no ve nada ----------
-- Esta función alimenta todas las políticas RLS del sistema. Al exigir que
-- el miembro esté activo, quien está esperando aprobación de su propio
-- equipo no ve proyectos, tickets, contratos ni nada más, sin tener que
-- tocar ninguna otra política.
create or replace function public.my_client_id()
returns uuid
language sql security definer set search_path = public stable
as $$
  select client_id from public.profiles
  where id = auth.uid() and member_status = 'activo';
$$;


-- ---------- Buscar organización por documento, para poder unirse ----------
-- Quien quiere unirse a su empresa no puede consultarla directamente: la RLS
-- de clients solo deja ver la propia. Esta función da la vía mínima — recibe
-- un documento y devuelve id y nombre, nada más.
--
-- Expone si un NIT está registrado y a nombre de quién. Es información
-- pública en Colombia (aparece en cualquier factura), y sin ella no hay forma
-- de que un empleado encuentre la cuenta de su propia empresa.
create or replace function public.buscar_cliente_por_documento(documento text)
returns table (id uuid, name text)
language sql security definer set search_path = public stable
as $$
  select c.id, c.name
  from public.clients c
  where c.tax_id = documento
  limit 1;
$$;


-- Responsables de una organización, para avisarles de quién pide unirse.
-- Igual que la anterior: quien solicita todavía no es miembro activo, así que
-- no puede leer los perfiles de esa organización por la vía normal.
create or replace function public.responsables_de_cliente(cliente_id uuid)
returns table (id uuid)
language sql security definer set search_path = public stable
as $$
  select p.id from public.profiles p
  where p.client_id = cliente_id and p.is_owner and p.member_status = 'activo';
$$;


-- ---------- Sin verificar no se firma ----------
create or replace function public.enforce_contract_client_verified()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  if new.status in ('en_revision','aprobado','firmado_jercol','vigente')
     and (old.status is distinct from new.status) then
    if not exists (select 1 from public.clients c
                   where c.id = new.client_id and c.status = 'verificado') then
      raise exception 'El cliente no está verificado. Revisa su expediente antes de avanzar el contrato.';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists on_contract_check_verified on contracts;
create trigger on_contract_check_verified
  before update on contracts
  for each row execute procedure public.enforce_contract_client_verified();


-- ---------- Bucket privado del expediente ----------
insert into storage.buckets (id, name, public)
values ('client-documents', 'client-documents', false)
on conflict (id) do nothing;

drop policy if exists "storage_cdoc_select" on storage.objects;
create policy "storage_cdoc_select" on storage.objects for select
  using (
    bucket_id = 'client-documents'
    and (
      public.is_admin()
      or (storage.foldername(name))[1] = public.my_client_id()::text
    )
  );

drop policy if exists "storage_cdoc_insert" on storage.objects;
create policy "storage_cdoc_insert" on storage.objects for insert
  with check (
    bucket_id = 'client-documents'
    and exists (select 1 from clients c
                where c.id::text = (storage.foldername(name))[1]
                  and c.registered_by = auth.uid())
  );

drop policy if exists "storage_cdoc_delete" on storage.objects;
create policy "storage_cdoc_delete" on storage.objects for delete
  using (bucket_id = 'client-documents' and public.is_admin());


-- ---------- Realtime ----------
alter publication supabase_realtime add table client_documents;


-- ======================================================================
-- Datos existentes
-- ======================================================================
-- Los clientes creados antes de esta migración quedan en 'verificado' y sin
-- documento fiscal. Si quieres completarlos, hazlo desde el panel o con:
--
--   update clients set tax_id = '900123456-7', kind = 'juridica'
--   where name = 'Inversiones Jercol';
--
-- Y para que un usuario existente sea el responsable de su empresa:
--
--   update profiles set is_owner = true
--   where email = 'correo-del-cliente@ejemplo.com';
