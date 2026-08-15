'use server';

import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';

/**
 * Envía el correo de restablecimiento.
 *
 * Responde siempre lo mismo, exista o no la cuenta. Si dijéramos "ese correo
 * no está registrado", cualquiera podría averiguar quiénes son clientes de
 * Jercol probando correos. Es una práctica estándar de autenticación.
 */
export async function pedirRecuperacion(formData: FormData) {
  const email = String(formData.get('email') || '').trim();
  if (!email) {
    redirect('/recuperar?error=' + encodeURIComponent('Escribe tu correo.'));
  }

  const supabase = await createClient();

  // El origen se toma de la petición para que funcione igual en local,
  // en los despliegues de prueba y en producción.
  const h = await headers();
  const origin =
    process.env.NEXT_PUBLIC_APP_URL ||
    (h.get('origin') ?? `https://${h.get('host') ?? 'localhost:3000'}`);

  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${origin}/recuperar/callback`,
  });

  if (error) console.error('pedirRecuperacion:', error);

  redirect('/recuperar?enviado=1');
}

/** Guarda la contraseña nueva. Requiere la sesión que crea el enlace del correo. */
export async function guardarNuevaClave(formData: FormData) {
  const password = String(formData.get('password') || '');
  const repetir = String(formData.get('password_repeat') || '');

  if (password.length < 6) {
    redirect(
      '/recuperar/nueva-clave?error=' +
        encodeURIComponent('La contraseña debe tener al menos 6 caracteres.')
    );
  }
  if (password !== repetir) {
    redirect(
      '/recuperar/nueva-clave?error=' + encodeURIComponent('Las dos contraseñas no coinciden.')
    );
  }

  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect(
      '/recuperar?error=' +
        encodeURIComponent('El enlace venció o ya se usó. Pide uno nuevo.')
    );
  }

  const { error } = await supabase.auth.updateUser({ password });
  if (error) {
    redirect('/recuperar/nueva-clave?error=' + encodeURIComponent(error.message));
  }

  redirect('/?clave=cambiada');
}
