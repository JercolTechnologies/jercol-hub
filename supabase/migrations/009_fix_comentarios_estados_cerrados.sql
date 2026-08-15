-- ======================================================================
-- 009_fix_comentarios_estados_cerrados.sql
-- ======================================================================
-- Corrige: el cliente no podía comentar en tarjetas en Backlog, En
-- Desarrollo ni Hecho, aunque el diseño dice que puede comentar siempre.
--
-- Causa (colisión entre dos triggers):
--   1. El cliente inserta el comentario. La política RLS lo permite.
--   2. bump_ticket_activity actualiza tickets.last_activity_at, que es lo
--      que alimenta el indicador de "hay algo nuevo".
--   3. Ese UPDATE dispara enforce_ticket_rules, que ve a un cliente
--      modificando una tarjeta en un estado donde no puede editar, y lanza
--      excepción.
--   4. La excepción revierte toda la transacción, incluido el comentario.
--
-- Arreglo: enforce_ticket_rules deja pasar los cambios donde lo único que
-- cambió es last_activity_at. Eso no es una edición del usuario, es una
-- consecuencia automática de comentar.
-- ======================================================================

create or replace function public.enforce_ticket_rules()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  if public.is_admin() then
    return new;
  end if;

  -- Si al quitar last_activity_at ambas versiones son idénticas, este UPDATE
  -- no lo hizo el usuario editando: lo hizo el sistema al registrar un
  -- comentario nuevo. Se permite sin más comprobaciones.
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
-- Cómo comprobarlo
-- ----------------------------------------------------------------------
-- Con una cuenta de cliente, comenta en una tarjeta que esté en Hecho.
-- Debe guardarse sin error, y el comentario debe aparecer en el hilo.
