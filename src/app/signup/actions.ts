'use server';

import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { adminProfileIds, notifyMany } from '@/lib/telegram/client';
import { msgCuentaNueva } from '@/lib/telegram/mensajes';

export async function signup(formData: FormData) {
  const fullName = String(formData.get('full_name') || '').trim();
  const email = String(formData.get('email') || '').trim();
  const password = String(formData.get('password') || '');

  if (!fullName || !email || !password) {
    redirect('/signup?error=' + encodeURIComponent('Completa todos los campos.'));
  }
  if (password.length < 6) {
    redirect('/signup?error=' + encodeURIComponent('La contraseña debe tener al menos 6 caracteres.'));
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: { data: { full_name: fullName } },
  });

  if (error) {
    redirect('/signup?error=' + encodeURIComponent(error.message));
  }

  // Avisa a Jercol que hay una cuenta nueva por asignar a un cliente.
  await notifyMany(
    await adminProfileIds(),
    `signup:${data.user?.id ?? email}`,
    msgCuentaNueva({ nombre: fullName, correo: email })
  );

  // Si el proyecto tiene "Confirm email" activado, no hay sesión todavía.
  if (!data.session) {
    redirect('/login?error=' + encodeURIComponent('Cuenta creada. Revisa tu correo para confirmarla y luego inicia sesión.'));
  }

  redirect('/');
}
