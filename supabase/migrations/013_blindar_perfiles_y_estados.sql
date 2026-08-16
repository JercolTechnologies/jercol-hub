-- ======================================================================
-- 013_blindar_perfiles_y_estados.sql
-- ======================================================================
-- HALLAZGO DE SEGURIDAD (escalada de privilegios)
--
-- La política "profiles_update_own" deja a cada usuario actualizar su
-- propia fila. Pero RLS filtra FILAS, no COLUMNAS: nada le impedía cambiar
-- su propio `role` a 'admin'.
--
-- Como la anon key es pública por diseño, cualquier cliente con sesión
-- podía llamar la API directamente:
--
--   PATCH /rest/v1/profiles?id=eq.<su-id>   { "role": "admin" }
--
-- y pasar a ver los contratos, documentos de identidad y proyectos de
-- todos los demás clientes.
--
-- La misma vía servía para auto-aprobarse (member_status) o hacerse
-- responsable de la organización (is_owner). Y la política
-- "profiles_update_owner" permitía a un responsable volver admin a
-- cualquiera de su equipo.
--
-- Existía desde la migración 001.
--
-- ARREGLO: un trigger que decide qué columnas puede tocar cada quien.
-- No se puede hacer con RLS porque es granularidad de columna.
-- ======================================================================

create or replace function public.enforce_profile_field_rules()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  -- El servidor actuando en nombre del sistema (service role) y los
  -- administradores no tienen restricción aquí.
  if auth.role() = 'service_role' or public.is_admin() then
    return new;
  end if;

  if new.role is distinct from old.role then
    raise exception 'No puedes cambiar el rol de una cuenta.';
  end if;

  -- La pertenencia a una organización se decide en el registro, desde el
  -- servidor. Nunca desde el navegador.
  if new.client_id is distinct from old.client_id then
    raise exception 'No puedes cambiar la organización de una cuenta.';
  end if;

  if new.is_owner is distinct from old.is_owner then
    raise exception 'No puedes cambiar quién administra la organización.';
  end if;

  -- Aprobar o rechazar miembros es potestad de quien administra esa
  -- organización, y solo sobre gente de la suya.
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

drop trigger if exists on_profile_update_rules on profiles;
create trigger on_profile_update_rules
  before update on profiles
  for each row execute procedure public.enforce_profile_field_rules();


-- ======================================================================
-- Un cliente no verificado tampoco debe recibir proyectos
-- ======================================================================
-- El contrato ya estaba protegido (migración 010), pero se podía crear un
-- proyecto para un cliente rechazado o pendiente, que es empezar a
-- trabajar antes de saber con quién se está tratando.

create or replace function public.enforce_project_client_verified()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  if not exists (select 1 from public.clients c
                 where c.id = new.client_id and c.status = 'verificado') then
    raise exception 'Ese cliente todavía no está verificado.';
  end if;
  return new;
end;
$$;

drop trigger if exists on_project_check_verified on projects;
create trigger on_project_check_verified
  before insert on projects
  for each row execute procedure public.enforce_project_client_verified();


-- ======================================================================
-- Comprobación
-- ======================================================================
-- Con una sesión de cliente, esto debe fallar con "No puedes cambiar el
-- rol de una cuenta":
--
--   update profiles set role = 'admin' where id = auth.uid();
