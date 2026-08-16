-- ======================================================================
-- 012_documentos_via_servidor.sql
-- ======================================================================
-- Los documentos del expediente ahora se suben desde el servidor con la
-- clave de servicio, así que sobran las políticas de escritura que tenían
-- que consultar `clients` para decidir.
--
-- Por qué se quitan en vez de dejarlas por si acaso: una política que
-- consulta otra tabla con RLS depende de que esa segunda tabla también
-- permita la lectura, y cuando falla el mensaje es un genérico "violates
-- row-level security policy" que no dice cuál de las dos falló. Costó una
-- ronda entera de depuración. Menos superficie, menos sitios donde mirar.
--
-- La LECTURA sigue protegida por RLS: el admin ve todo, el cliente solo lo
-- suyo. Eso es lo que importa aquí, porque son documentos de identidad.
-- ======================================================================

drop policy if exists "storage_cdoc_insert" on storage.objects;
drop policy if exists "cdoc_insert_registro" on client_documents;


-- ---------- Comprobación ----------
-- Las políticas que deben quedar sobre client_documents son dos de lectura
-- (admin y cliente propio) más la de admin para todo:
--
--   select policyname, cmd from pg_policies
--   where tablename = 'client_documents';
--
-- Y sobre storage.objects, para este bucket, solo lectura y borrado:
--
--   select policyname, cmd from pg_policies
--   where tablename = 'objects' and policyname like 'storage_cdoc%';
