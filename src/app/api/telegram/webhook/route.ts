import { NextResponse, type NextRequest } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { msgVinculacionOk } from '@/lib/telegram/mensajes';

export const dynamic = 'force-dynamic';

/**
 * Webhook de Telegram.
 *
 * Solo maneja el comando /start con token: es el paso que vincula una cuenta
 * de la app con un chat de Telegram. Un bot no puede escribirle a nadie que
 * no lo haya activado antes, así que este intercambio es obligatorio.
 *
 * La ruta es pública (Telegram tiene que poder llamarla), por eso se valida
 * el secreto que Telegram envía en cada petición. Sin esa cabecera, cualquiera
 * podría inventar mensajes y vincular cuentas ajenas.
 */

async function sendPlain(chatId: number | string, text: string) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) return;
  await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, text, parse_mode: 'HTML' }),
  });
}

export async function POST(request: NextRequest) {
  const secret = process.env.TELEGRAM_WEBHOOK_SECRET;
  if (!secret || request.headers.get('x-telegram-bot-api-secret-token') !== secret) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  let update: {
    message?: { text?: string; chat?: { id: number }; from?: { first_name?: string } };
  };
  try {
    update = await request.json();
  } catch {
    return NextResponse.json({ ok: true });
  }

  const text = update.message?.text?.trim() || '';
  const chatId = update.message?.chat?.id;
  if (!chatId) return NextResponse.json({ ok: true });

  // ---------- /start <token> ----------
  if (text.startsWith('/start')) {
    const parts = text.split(/\s+/);
    const token = parts[1];

    if (!token) {
      await sendPlain(
        chatId,
        'Para conectar tu cuenta, entra a Jercol Hub y usa el botón <b>Conectar Telegram</b>. ' +
          'Ese botón abre este chat con un código de un solo uso.'
      );
      return NextResponse.json({ ok: true });
    }

    const admin = createAdminClient();

    const { data: row } = await admin
      .from('telegram_link_tokens')
      .select('token, profile_id, expires_at, used_at')
      .eq('token', token)
      .maybeSingle();

    if (!row || row.used_at || new Date(row.expires_at as string) < new Date()) {
      await sendPlain(
        chatId,
        'Ese código ya se usó o venció. Genera uno nuevo desde Jercol Hub e inténtalo otra vez.'
      );
      return NextResponse.json({ ok: true });
    }

    // Marcar usado antes de vincular: si la misma actualización llega dos
    // veces (Telegram reintenta), la segunda ya no encuentra el token libre.
    const { data: claimed } = await admin
      .from('telegram_link_tokens')
      .update({ used_at: new Date().toISOString() })
      .eq('token', token)
      .is('used_at', null)
      .select('profile_id')
      .maybeSingle();

    if (!claimed) return NextResponse.json({ ok: true });

    await admin
      .from('profiles')
      .update({ telegram_chat_id: String(chatId), telegram_enabled: true })
      .eq('id', claimed.profile_id);

    const { data: profile } = await admin
      .from('profiles')
      .select('full_name')
      .eq('id', claimed.profile_id)
      .maybeSingle();

    await sendPlain(
      chatId,
      msgVinculacionOk(profile?.full_name || update.message?.from?.first_name || '')
    );
    return NextResponse.json({ ok: true });
  }

  // ---------- /stop ----------
  if (text.startsWith('/stop')) {
    const admin = createAdminClient();
    await admin
      .from('profiles')
      .update({ telegram_enabled: false })
      .eq('telegram_chat_id', String(chatId));
    await sendPlain(
      chatId,
      'Listo, no te vuelvo a escribir. Puedes reactivar los avisos desde tu perfil en Jercol Hub.'
    );
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ ok: true });
}
