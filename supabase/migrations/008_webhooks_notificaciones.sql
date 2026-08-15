-- ======================================================================
-- 008_webhooks_notificaciones.sql
-- ======================================================================
-- Triggers que avisan a la app cuando pasa algo en el tablero.
--
-- Reemplaza a los "Database Webhooks" del panel de Supabase, que fallaban
-- con: schema "supabase_functions" does not exist.
--
-- Los Database Webhooks del panel no son más que esto: triggers que llaman
-- a net.http_post. Hacerlos a mano tiene además la ventaja de quedar
-- versionados en el repo, en vez de vivir solo en la interfaz de Supabase.
--
-- ⚠ ANTES DE EJECUTAR: reemplaza PON_AQUI_EL_NOTIFY_WEBHOOK_SECRET por el
-- valor real de NOTIFY_WEBHOOK_SECRET (está en webapp/.env.local).
-- El archivo se guarda con el marcador a propósito: los .sql sí se suben al
-- repositorio y el secreto no debe quedar ahí.
-- ======================================================================


-- ----------------------------------------------------------------------
-- Paso 0 (comprobación). pg_net crea sus funciones en el esquema `net`.
-- Si esta consulta devuelve otro esquema, ajusta las llamadas de abajo.
-- ----------------------------------------------------------------------
-- select n.nspname as esquema, p.proname as funcion
-- from pg_proc p join pg_namespace n on n.oid = p.pronamespace
-- where p.proname = 'http_post';


create extension if not exists pg_net;


-- ----------------------------------------------------------------------
-- Función que arma el aviso y lo manda.
--
-- El cuerpo replica el formato de los Database Webhooks de Supabase
-- (type / table / record / old_record) porque es el que espera la ruta
-- /api/notificaciones/db.
-- ----------------------------------------------------------------------
create or replace function public.notificar_app()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform net.http_post(
    url := 'https://jercol-hub.vercel.app/api/notificaciones/db',
    body := jsonb_build_object(
      'type', tg_op,
      'table', tg_table_name,
      'record', to_jsonb(new),
      'old_record', case when tg_op = 'UPDATE' then to_jsonb(old) else null end
    ),
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-notify-secret', 'PON_AQUI_EL_NOTIFY_WEBHOOK_SECRET'
    ),
    timeout_milliseconds := 5000
  );

  return new;
end;
$$;


-- ----------------------------------------------------------------------
-- Triggers.
--
-- AFTER a propósito: si la llamada HTTP fallara, no debe impedir que se
-- guarde el comentario o el cambio de estado. El aviso es secundario.
-- ----------------------------------------------------------------------

drop trigger if exists on_comment_notificar on comments;
create trigger on_comment_notificar
  after insert on comments
  for each row execute function public.notificar_app();

drop trigger if exists on_ticket_insert_notificar on tickets;
create trigger on_ticket_insert_notificar
  after insert on tickets
  for each row execute function public.notificar_app();

drop trigger if exists on_ticket_update_notificar on tickets;
create trigger on_ticket_update_notificar
  after update on tickets
  for each row execute function public.notificar_app();


-- ----------------------------------------------------------------------
-- Cómo verificar que salieron las llamadas
-- ----------------------------------------------------------------------
-- pg_net trabaja en segundo plano y guarda el resultado de cada llamada.
-- Después de comentar algo en el tablero, revisa:
--
--   select id, status_code, created
--   from net._http_response
--   order by created desc
--   limit 10;
--
-- status_code 200 = la app recibió el aviso.
-- 401 = el secreto no coincide con NOTIFY_WEBHOOK_SECRET de Vercel.
-- Sin filas = el trigger no se disparó.
