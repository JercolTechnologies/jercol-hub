-- ======================================================================
-- 015_triggers_no_bloquean_cascadas.sql
-- ======================================================================
-- FALLO DE DISEÑO, encontrado al intentar borrar una organización de prueba:
--
--   delete from clients where id = '...';
--   ERROR: No puedes cambiar la organización de una cuenta.
--   CONTEXT: PL/pgSQL function enforce_profile_field_rules()
--   SQL statement "UPDATE ONLY profiles SET client_id = NULL WHERE ..."
--
-- Ese UPDATE no lo escribió nadie: lo genera Postgres para cumplir la llave
-- foránea `profiles.client_id -> clients(id) ON DELETE SET NULL`. Los
-- triggers de autorización no distinguían entre "un usuario intenta algo"
-- y "el motor mantiene su propia integridad referencial", así que
-- bloqueaban lo segundo.
--
-- No es un problema del SQL Editor. Con el código actual:
--   * No se puede borrar una organización (FK profiles.client_id).
--   * No se puede borrar un usuario que haya creado tarjetas
--     (FK tickets.created_by, y enforce_ticket_rules prohíbe expresamente
--     que created_by cambie).
--   * No se puede borrar un usuario que haya creado un contrato vigente
--     (enforce_contract_immutability rechaza cualquier UPDATE).
--
-- Es decir: el sistema no permite dar de baja a nadie. Habría aparecido en
-- producción, el día de una baja real, con datos reales.
--
-- La regla general que queda: un trigger que autoriza acciones de usuario
-- tiene que reconocer cuándo la operación no viene de un usuario.
-- ======================================================================


-- ----------------------------------------------------------------------
-- 1. profiles — salida por ausencia de sesión
-- ----------------------------------------------------------------------
-- Este trigger existe para defenderse de llamadas directas a la API con la
-- anon key, y en esas SIEMPRE hay sesión: auth.uid() nunca es null. Si es
-- null, la operación viene de una cascada de FK, del SQL Editor o de una
-- tarea de mantenimiento.
--
-- No abre ningún hueco: sin sesión, las políticas RLS de profiles ya
-- bloquean el acceso antes de que este trigger llegue a ejecutarse.

create or replace function public.enforce_profile_field_rules()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  if auth.uid() is null
     or auth.role() = 'service_role'
     or public.is_admin() then
    return new;
  end if;

  if new.role is distinct from old.role then
    raise exception 'No puedes cambiar el rol de una cuenta.';
  end if;

  if new.client_id is distinct from old.client_id then
    raise exception 'No puedes cambiar la organización de una cuenta.';
  end if;

  if new.is_owner is distinct from old.is_owner then
    raise exception 'No puedes cambiar quién administra la organización.';
  end if;

  if new.member_status is distinct from old.member_status then
    if not exists (
      select 1 from public.profiles p
      where p.id = auth.uid()
        and p.is_owner
        and p.member_status = 'activo'
        and p.client_id = old.client_id
    ) then
      raise exception 'Solo quien administra la cuenta de la organización puede aprobar o quitar miembros.';
    end if;
  end if;

  return new;
end;
$$;


-- ----------------------------------------------------------------------
-- 2. tickets — misma salida
-- ----------------------------------------------------------------------
-- `tickets.created_by -> profiles(id) ON DELETE SET NULL`. Al borrar un
-- perfil, Postgres pone created_by a null, y la última regla de esta
-- función prohíbe expresamente que created_by cambie.

create or replace function public.enforce_ticket_rules()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  -- Sin sesión no hay usuario editando: es una cascada o mantenimiento.
  if auth.uid() is null or public.is_admin() then
    return new;
  end if;

  -- Si al quitar last_activity_at ambas versiones son idénticas, este UPDATE
  -- no lo hizo el usuario editando: lo hizo el sistema al registrar un
  -- comentario nuevo. Se permite sin más comprobaciones. (Migración 009.)
  if to_jsonb(new) - 'last_activity_at' = to_jsonb(old) - 'last_activity_at' then
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


-- ----------------------------------------------------------------------
-- 3. contracts — aquí NO se usa la ausencia de sesión, a propósito
-- ----------------------------------------------------------------------
-- La inmutabilidad de un contrato firmado es la garantía legal del sistema
-- y esta función nunca ha dependido de quién ejecuta: bloquea a todos por
-- igual, que es exactamente lo que debe hacer. Añadirle una salida por
-- "no hay sesión" cambiaría su naturaleza y dejaría un contrato vigente
-- modificable desde cualquier vía sin sesión.
--
-- Se usa el patrón de la migración 009: reconocer la operación concreta
-- por su forma. Si lo ÚNICO que cambia es created_by pasando a null, eso
-- no es una edición del contrato: es la base de datos desvinculando a un
-- autor que se dio de baja. El texto, el estado, el PDF y las firmas
-- siguen intactos.

create or replace function public.enforce_contract_immutability()
returns trigger
language plpgsql
as $$
begin
  if old.status = 'vigente' then
    if new.created_by is null
       and old.created_by is not null
       and to_jsonb(new) - 'created_by' = to_jsonb(old) - 'created_by' then
      return new;
    end if;

    raise exception 'Este contrato ya está firmado y no puede modificarse.';
  end if;

  return new;
end;
$$;


-- ======================================================================
-- Comprobación
-- ======================================================================
-- 1. Que la protección sigue viva. Con sesión de cliente en la app, esto
--    debe seguir fallando:
--      update profiles set role = 'admin' where id = auth.uid();
--
-- 2. Que ya se puede dar de baja. En el SQL Editor:
--      delete from clients where id = '<id de una organización de prueba>';
--    Debe borrar sin error y dejar a sus miembros con client_id en null.
