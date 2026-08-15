'use server';

import { randomBytes } from 'crypto';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';

async function requireUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');
  return { supabase, user };
}

/**
 * Genera un código de un solo uso y devuelve el enlace que abre el bot.
 * El código caduca a los 15 minutos (lo define la base de datos).
 */
export async function crearEnlaceTelegram(): Promise<string | null> {
  const { supabase, user } = await requireUser();

  const bot = process.env.NEXT_PUBLIC_TELEGRAM_BOT_USERNAME;
  if (!bot) {
    console.error('Falta NEXT_PUBLIC_TELEGRAM_BOT_USERNAME');
    return null;
  }

  const token = randomBytes(16).toString('hex');
  const { error } = await supabase
    .from('telegram_link_tokens')
    .insert({ token, profile_id: user.id });

  if (error) {
    console.error('crearEnlaceTelegram:', error);
    return null;
  }

  return `https://t.me/${bot.replace(/^@/, '')}?start=${token}`;
}

export async function desconectarTelegram() {
  const { supabase, user } = await requireUser();
  await supabase
    .from('profiles')
    .update({ telegram_chat_id: null, telegram_enabled: true })
    .eq('id', user.id);
  revalidatePath('/perfil');
}

export async function cambiarAvisos(activar: boolean) {
  const { supabase, user } = await requireUser();
  await supabase.from('profiles').update({ telegram_enabled: activar }).eq('id', user.id);
  revalidatePath('/perfil');
}

export async function cambiarClave(formData: FormData) {
  const { supabase } = await requireUser();

  const password = String(formData.get('password') || '');
  const repetir = String(formData.get('password_repeat') || '');

  if (password.length < 6) {
    redirect('/perfil?error=' + encodeURIComponent('La contraseña debe tener al menos 6 caracteres.'));
  }
  if (password !== repetir) {
    redirect('/perfil?error=' + encodeURIComponent('Las dos contraseñas no coinciden.'));
  }

  const { error } = await supabase.auth.updateUser({ password });
  if (error) {
    redirect('/perfil?error=' + encodeURIComponent(error.message));
  }

  redirect('/perfil?ok=' + encodeURIComponent('Contraseña actualizada.'));
}
