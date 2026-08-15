-- ======================================================================
-- 006_contratos_firma.sql
-- ======================================================================
-- Contratos, fase B: firma electrónica.
--
-- - Vincula un contacto con una cuenta real de la app, para que la firma
--   sea atribuible a una persona concreta y no a "alguien del cliente".
-- - Registra cada firma con su rastro digital (IP, dispositivo, fecha,
--   nombre, documento y huella SHA-256 del PDF firmado).
-- - Bloquea el contrato una vez vigente: no se editan datos ni se suben
--   versiones nuevas.
-- ======================================================================

-- ---------- Vínculo contacto <-> cuenta de la app ----------
alter table client_contacts add column if not exists profile_id uuid references profiles(id) on delete set null;

-- ---------- PDF final firmado ----------
alter table contracts add column if not exists signed_path text;
alter table contracts add column if not exists signed_at timestamptz;

-- ---------- Firmas ----------
create table if not exists contract_signatures (
  id uuid primary key default gen_random_uuid(),
  contract_id uuid not null references contracts(id) on delete cascade,
  signer_role text not null check (signer_role in ('jercol','cliente')),
  profile_id uuid references profiles(id) on delete set null,
  contact_id uuid references client_contacts(id) on delete set null,
  version_id uuid references contract_versions(id) on delete set null,
  full_name text not null,
  document_id text not null,
  signature_path text,
  document_sha256 text,
  ip text,
  user_agent text,
  signed_at timestamptz not null default now(),
  unique (contract_id, signer_role)
);
alter table contract_signatures enable row level security;

-- Lectura: admin siempre; el cliente solo las de sus contratos publicados.
-- No hay política de INSERT a propósito: las firmas las escribe el servidor
-- con la service role key, después de verificar identidad y orden.
drop policy if exists "csig_admin_select" on contract_signatures;
create policy "csig_admin_select" on contract_signatures for select using (public.is_admin());

drop policy if exists "csig_select_own" on contract_signatures;
create policy "csig_select_own" on contract_signatures for select using (
  exists (select 1 from contracts c where c.id = contract_signatures.contract_id
          and c.client_id = public.my_client_id() and c.status <> 'borrador')
);

-- ---------- Inmutabilidad una vez vigente ----------
create or replace function public.enforce_contract_immutability()
returns trigger
language plpgsql
as $$
begin
  -- Se permite la transición que completa la firma (firmado_jercol -> vigente),
  -- porque en esa misma sentencia se guarda el PDF final.
  if old.status = 'vigente' then
    raise exception 'Este contrato ya está firmado y no puede modificarse.';
  end if;
  return new;
end;
$$;

drop trigger if exists on_contract_update_immutable on contracts;
create trigger on_contract_update_immutable
  before update on contracts
  for each row execute procedure public.enforce_contract_immutability();

create or replace function public.enforce_no_new_versions_when_signed()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  if exists (select 1 from public.contracts c
             where c.id = new.contract_id and c.status = 'vigente') then
    raise exception 'No se pueden subir versiones a un contrato ya firmado.';
  end if;
  return new;
end;
$$;

drop trigger if exists on_version_insert_check_signed on contract_versions;
create trigger on_version_insert_check_signed
  before insert on contract_versions
  for each row execute procedure public.enforce_no_new_versions_when_signed();

-- ---------- Realtime ----------
alter publication supabase_realtime add table contract_signatures;
