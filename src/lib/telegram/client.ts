import 'server-only';

import { createAdminClient } from '@/lib/supabase/admin';

const API = 'https://api.telegram.org';

function botToken() {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) throw new Error('Falta TELEGRAM_BOT_TOKEN en las variables de entorno.');
  return token;
}

/** Telegram interpreta estos caracteres como formato; hay que escaparlos. */
export function escapeHtml(text: string) {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/**
 * Envía un mensaje y deja constancia en notifications_log.
 *
 * `eventKey` identifica el hecho concreto (por ejemplo
 * `comment:<uuid>:<destinatario>`). La tabla tiene índice único sobre esa
 * columna, así que si un webhook se entrega dos veces —Telegram y Supabase
 * reintentan ante errores— el segundo intento choca y no se reenvía nada.
 *
 * Nunca lanza excepción: una notificación fallida no debe tumbar la acción
 * que la originó (crear un contrato, firmar, comentar).
 */
export async function notify({
  profileId,
  eventKey,
  text,
}: {
  profileId: string;
  eventKey: string;
  text: string;
}): Promise<void> {
  try {
    const admin = createAdminClient();

    const { data: profile } = await admin
      .from('profiles')
      .select('telegram_chat_id, telegram_enabled')
      .eq('id', profileId)
      .maybeSingle();

    if (!profile?.telegram_chat_id || !profile.telegram_enabled) return;

    // Reserva el envío antes de mandarlo. Si otra ejecución ya lo reservó,
    // el unique falla y salimos sin duplicar el mensaje.
    const { error: claimError } = await admin.from('notifications_log').insert({
      profile_id: profileId,
      event_key: eventKey,
      chat_id: profile.telegram_chat_id,
    });
    if (claimError) return;

    const res = await fetch(`${API}/bot${botToken()}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: profile.telegram_chat_id,
        text,
        parse_mode: 'HTML',
        link_preview_options: { is_disabled: true },
      }),
    });

    if (!res.ok) {
      const detail = await res.text();
      console.error('Telegram sendMessage falló:', detail);
      await admin
        .from('notifications_log')
        .update({ ok: false, error: detail.slice(0, 500) })
        .eq('event_key', eventKey);
    }
  } catch (e) {
    console.error('notify:', e);
  }
}

/** Envía el mismo aviso a varias personas (por ejemplo, todo el equipo del cliente). */
export async function notifyMany(
  profileIds: string[],
  eventKeyBase: string,
  text: string
): Promise<void> {
  await Promise.all(
    profileIds.map((id) => notify({ profileId: id, eventKey: `${eventKeyBase}:${id}`, text }))
  );
}

/** Todos los administradores de Jercol. */
export async function adminProfileIds(): Promise<string[]> {
  const admin = createAdminClient();
  const { data } = await admin.from('profiles').select('id').eq('role', 'admin');
  return (data || []).map((p) => p.id as string);
}

/** Cuentas de un cliente, opcionalmente excluyendo a quien originó el evento. */
export async function clientProfileIds(clientId: string, exceptId?: string): Promise<string[]> {
  const admin = createAdminClient();
  const { data } = await admin
    .from('profiles')
    .select('id')
    .eq('client_id', clientId)
    .eq('role', 'client');
  return (data || []).map((p) => p.id as string).filter((id) => id !== exceptId);
}
