-- ======================================================================
-- 000_verificar_estado.sql
-- ======================================================================
-- NO modifica nada. Córrelo en el SQL Editor cuando no recuerdes qué
-- migraciones ya aplicaste. Devuelve una fila por migración con OK o FALTA.
-- ======================================================================

select
  '001_esquema_inicial' as migracion,
  case when to_regclass('public.tickets') is not null
       and to_regclass('public.profiles') is not null
       then 'OK' else 'FALTA' end as estado

union all
select
  '002_estados_fechas_adjuntos_ideas',
  case when to_regclass('public.project_ideas') is not null
       and to_regclass('public.attachments') is not null
       and to_regclass('public.ticket_reads') is not null
       and exists (
         select 1 from information_schema.columns
         where table_schema = 'public' and table_name = 'tickets'
           and column_name = 'desired_date'
       )
       then 'OK' else 'FALTA' end

union all
select
  '003_adjuntos_ideas',
  case when to_regclass('public.idea_attachments') is not null
       then 'OK' else 'FALTA' end

union all
select
  '004_link_staging',
  case when to_regclass('public.ticket_staging') is not null
       then 'OK' else 'FALTA' end

union all
select
  '005_contratos_fase_a',
  case when to_regclass('public.contracts') is not null
       and to_regclass('public.client_contacts') is not null
       and to_regclass('public.contract_addenda') is not null
       then 'OK' else 'FALTA' end

order by migracion;


-- ----------------------------------------------------------------------
-- Comprobaciones sueltas útiles
-- ----------------------------------------------------------------------

-- ¿Los buckets de Storage existen?
-- select id, public from storage.buckets order by id;

-- ¿Qué estados tienen hoy los tickets? (tras 002 no debe quedar 'en_progreso')
-- select status, count(*) from public.tickets group by status;

-- ¿Qué tablas están publicando en realtime?
-- select tablename from pg_publication_tables where pubname = 'supabase_realtime' order by tablename;
