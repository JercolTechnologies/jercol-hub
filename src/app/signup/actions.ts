'use server';

import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';

/** Caminos posibles después de crear la cuenta. */
const CAMINOS = ['empresa', 'unirme'] as const;
type Camino = (typeof CAMINOS)[number];

export async function signup(formData: FormData) {
  const fullName = String(formData.get('full_name') || '').trim();
  const email = String(formData.get('email') || '').trim();
  const password = String(formData.get('password') || '');
  const caminoBruto = String(formData.get('camino') || '');

  if (!fullName || !email || !password) {
    redirect('/signup?error=' + encodeURIComponent('Completa todos los campos.'));
  }
  if (password.length < 6) {
    redirect('/signup?error=' + encodeURIComponent('La contraseña debe tener al menos 6 caracteres.'));
  }
  if (!CAMINOS.includes(caminoBruto as Camino)) {
    redirect('/signup?error=' + encodeURIComponent('Elige si vas a registrar tu organización o unirte a una existente.'));
  }

  const supabase = await createClient();

  // El camino elegido viaja en los metadatos de la cuenta, no en la URL de
  // confirmación del correo. Así sobrevive aunque la persona confirme desde
  // otro dispositivo, o entre por /login en vez de por el enlace. El trigger
  // handle_new_user ya lee de aquí (full_name); un campo más no le afecta.
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: { data: { full_name: fullName, camino: caminoBruto } },
  });

  if (error) {
    redirect('/signup?error=' + encodeURIComponent(error.message));
  }

  // Aquí no se avisa a nadie: crear la cuenta es solo el primer paso. El
  // aviso sale cuando la persona completa el registro de su organización
  // (a Jercol) o pide unirse a una existente (a quien la administra).

  // Si el proyecto tiene "Confirm email" activado, no hay sesión todavía.
  if (!data.session) {
    redirect('/login?error=' + encodeURIComponent('Cuenta creada. Revisa tu correo para confirmarla y luego inicia sesión.'));
  }

  redirect('/');
}
