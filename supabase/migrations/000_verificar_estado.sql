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

union all
select
  '006_contratos_firma',
  case when to_regclass('public.contract_signatures') is not null
       and exists (
         select 1 from information_schema.columns
         where table_schema = 'public' and table_name = 'client_contacts'
           and column_name = 'profile_id'
       )
       then 'OK' else 'FALTA' end

union all
select
  '007_telegram',
  case when to_regclass('public.telegram_link_tokens') is not null
       and to_regclass('public.notifications_log') is not null
       and exists (
         select 1 from information_schema.columns
         where table_schema = 'public' and table_name = 'profiles'
           and column_name = 'telegram_chat_id'
       )
       then 'OK' else 'FALTA' end

union all
select
  '008_webhooks_notificaciones',
  case when exists (
         select 1 from pg_trigger
         where tgname in ('on_comment_notificar', 'on_ticket_update_notificar')
       )
       then 'OK' else 'FALTA' end

union all
select
  '009_fix_comentarios_estados_cerrados',
  case when exists (
         select 1 from pg_proc
         where proname = 'enforce_ticket_rules'
           and prosrc like '%last_activity_at%'
       )
       then 'OK' else 'FALTA' end

union all
select
  '010_expediente_cliente',
  case when to_regclass('public.client_documents') is not null
       and exists (
         select 1 from information_schema.columns
         where table_schema = 'public' and table_name = 'clients'
           and column_name = 'tax_id'
       )
       and exists (
         select 1 from information_schema.columns
         where table_schema = 'public' and table_name = 'profiles'
           and column_name = 'member_status'
       )
       then 'OK' else 'FALTA' end

union all
select
  '011_fix_registro_y_cedula',
  case when exists (
         select 1 from pg_policies
         where tablename = 'clients' and policyname = 'clients_select_registrant'
       )
       then 'OK' else 'FALTA' end

union all
select
  '012_documentos_via_servidor',
  case when not exists (
         select 1 from pg_policies
         where tablename = 'objects' and policyname = 'storage_cdoc_insert'
       )
       and to_regclass('public.client_documents') is not null
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
