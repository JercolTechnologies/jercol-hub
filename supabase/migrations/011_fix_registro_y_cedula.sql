-- ======================================================================
-- 011_fix_registro_y_cedula.sql
-- ======================================================================
-- Dos correcciones sobre la 010.
--
-- 1. El registro fallaba siempre.
--    La acción hace insert().select('id') para recuperar el id del cliente
--    recién creado. Ese select pasa por las políticas de lectura, y en ese
--    momento el perfil todavía no tiene client_id (se asigna después), así
--    que ninguna política le dejaba ver la fila que acababa de insertar.
--    PostgREST devolvía error y el registro se abortaba entero.
--
--    Insertar y no poder leer lo insertado es una trampa fácil de pasar por
--    alto: la escritura estaba bien permitida, lo que faltaba era la lectura.
--
-- 2. La cédula necesita las dos caras.
-- ======================================================================


-- ---------- Quien registra puede ver su propia ficha ----------
drop policy if exists "clients_select_registrant" on clients;
create policy "clients_select_registrant" on clients for select
  using (registered_by = auth.uid());


-- ---------- Cédula por ambas caras ----------
alter table client_documents drop constraint if exists client_documents_kind_check;
alter table client_documents add constraint client_documents_kind_check
  check (kind in ('rut','cedula','cedula_reverso','camara','otro'));


-- ---------- Comprobación ----------
-- Después de correr esto, el registro de una organización nueva debe
-- completarse sin error. Si vuelve a fallar, el detalle real aparece ahora
-- en el mensaje de la propia pantalla.
