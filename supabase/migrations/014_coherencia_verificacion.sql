-- ======================================================================
-- 014_coherencia_verificacion.sql
-- ======================================================================
-- Dos arreglos de coherencia sobre el expediente del cliente:
--
--   1. Un cliente que no está verificado no puede conservar fecha de
--      verificación. Se resuelve con trigger y no en la Server Action
--      porque el riesgo real es que alguien —yo mismo dentro de tres
--      meses— escriba `if (cliente.verified_at)` en vez de mirar el
--      estado, y encuentre una fecha válida en un cliente rechazado.
--      Limpiarlo en la función que rechaza depende de que quien escriba
--      la próxima función se acuerde; el trigger no depende de nadie.
--
--   2. Buscar organización por documento devolvía también las rechazadas
--      y las archivadas, así que alguien podía pedir ingreso a una
--      organización que ya no existe operativamente y quedarse esperando
--      una aprobación que nunca iba a llegar.
-- ======================================================================


-- ----------------------------------------------------------------------
-- 1. La fecha de verificación solo existe si el estado es 'verificado'
-- ----------------------------------------------------------------------

create or replace function public.enforce_client_verification_fields()
returns trigger
language plpgsql
as $$
begin
  if new.status is distinct from 'verificado' then
    new.verified_at := null;
    new.verified_by := null;
  end if;

  -- El motivo de rechazo tampoco tiene sentido fuera del rechazo: si
  -- quedara pegado, un cliente ya verificado seguiría mostrando el texto
  -- de por qué se le rechazó alguna vez.
  if new.status is distinct from 'rechazado' then
    new.rejection_reason := null;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_client_verification_fields on public.clients;

create trigger trg_client_verification_fields
  before insert or update on public.clients
  for each row execute function public.enforce_client_verification_fields();


-- Corrige lo que ya está guardado. Sin esto el trigger solo protege hacia
-- adelante y las filas escritas antes conservan la incoherencia.
update public.clients
   set verified_at = null,
       verified_by = null
 where status is distinct from 'verificado'
   and (verified_at is not null or verified_by is not null);

update public.clients
   set rejection_reason = null
 where status is distinct from 'rechazado'
   and rejection_reason is not null;


-- ----------------------------------------------------------------------
-- 2. Buscar organización: solo las que siguen vivas
-- ----------------------------------------------------------------------
-- 'pendiente' sí aparece a propósito: la organización se registró y está
-- esperando verificación, y mientras tanto su equipo puede ir pidiendo
-- ingreso. 'rechazado' y archivadas no: son caminos sin salida.

create or replace function public.buscar_cliente_por_documento(documento text)
returns table (id uuid, name text)
language sql
security definer
set search_path = public
stable
as $$
  select c.id, c.name
  from public.clients c
  where c.tax_id = documento
    and c.status in ('pendiente', 'verificado')
    and coalesce(c.archived, false) = false
  limit 1;
$$;
