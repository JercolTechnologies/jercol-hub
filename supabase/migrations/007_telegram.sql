-- ======================================================================
-- 007_telegram.sql
-- ======================================================================
-- Notificaciones por Telegram.
--
-- - Vincula cada cuenta con su chat de Telegram (un bot no puede escribirle
--   a nadie que no lo haya activado primero, de ahí el token de un solo uso).
-- - Interruptor por persona para apagar los avisos.
-- - Registro de envíos, para no repetir el mismo aviso si un webhook se
--   entrega dos veces (Telegram y Supabase reintentan ante fallos).
-- ======================================================================

-- ---------- Vínculo y preferencia ----------
alter table profiles add column if not exists telegram_chat_id text;
alter table profiles add column if not exists telegram_enabled boolean not null default true;

-- ---------- Tokens de vinculación (un solo uso, con caducidad) ----------
create table if not exists telegram_link_tokens (
  token text primary key,
  profile_id uuid not null references profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '15 minutes'),
  used_at timestamptz
);
alter table telegram_link_tokens enable row level security;

-- Cada quien puede crear y ver solo sus propios tokens. El canje lo hace el
-- servidor con service role, porque quien llega por Telegram todavía no tiene
-- sesión en la app.
drop policy if exists "tlt_own" on telegram_link_tokens;
create policy "tlt_own" on telegram_link_tokens for all
  using (profile_id = auth.uid()) with check (profile_id = auth.uid());

-- ---------- Registro de avisos enviados ----------
create table if not exists notifications_log (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid references profiles(id) on delete set null,
  event_key text not null,
  chat_id text,
  ok boolean not null default true,
  error text,
  created_at timestamptz not null default now(),
  -- event_key identifica el hecho concreto (p. ej. 'comment:<uuid>:<destinatario>')
  unique (event_key)
);
alter table notifications_log enable row level security;

-- Nadie lo consulta desde la app: lo escribe el servidor con service role.
drop policy if exists "notif_admin_select" on notifications_log;
create policy "notif_admin_select" on notifications_log for select using (public.is_admin());

create index if not exists notifications_log_created_at_idx on notifications_log (created_at desc);
