-- ======================================================================
-- 016_perfil_sin_organizacion.sql
-- ======================================================================
-- Al borrar una organización, la FK `profiles.client_id -> clients(id)
-- ON DELETE SET NULL` deja a sus miembros sin organización. Pero solo
-- toca esa columna: `is_owner` se queda como estaba.
--
-- Resultado observado tras borrar una organización de prueba: un perfil
-- con `client_id = null` e `is_owner = true`. Alguien que administra una
-- organización que no existe.
--
-- Hoy no rompe nada porque las dos acciones de registro reescriben
-- is_owner al entrar a una organización nueva. Pero es el mismo tipo de
-- incoherencia que `verified_at` en un cliente rechazado (migración 014):
-- un campo que sobrevive al estado que le daba sentido, esperando a que
-- alguien lo lea y saque la conclusión equivocada.
--
-- Mismo criterio que allí: la coherencia se declara en la base, no se
-- confía a que cada función que toque client_id se acuerde.
-- ======================================================================

create or replace function public.enforce_profile_coherence()
returns trigger
language plpgsql
as $$
begin
  -- Sin organización no se administra nada.
  if new.client_id is null then
    new.is_owner := false;
  end if;

  return new;
end;
$$;

-- El nombre importa: Postgres dispara los triggers de una tabla en orden
-- alfabético, y este tiene que correr DESPUÉS de
-- `on_profile_update_rules`. Primero se decide si el cambio está
-- permitido, y solo entonces se normaliza el resultado.
drop trigger if exists trg_profile_coherence on public.profiles;

create trigger trg_profile_coherence
  before insert or update on public.profiles
  for each row execute function public.enforce_profile_coherence();


-- Corrige lo que ya está guardado. El trigger solo protege hacia adelante.
update public.profiles
   set is_owner = false
 where client_id is null
   and is_owner;


-- ======================================================================
-- Comprobación
-- ======================================================================
-- No debe devolver ninguna fila:
--
--   select id, email, client_id, is_owner
--   from public.profiles
--   where client_id is null and is_owner;
