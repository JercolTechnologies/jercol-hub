import { NextResponse, type NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

/**
 * Aterrizaje del enlace que llega por correo.
 *
 * Supabase manda un código de un solo uso en la URL; aquí se canjea por una
 * sesión temporal. Con esa sesión el usuario puede fijar su contraseña nueva
 * en /recuperar/nueva-clave, y solo eso.
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');
  const errorDescription = searchParams.get('error_description');

  if (errorDescription) {
    return NextResponse.redirect(
      `${origin}/recuperar?error=${encodeURIComponent(errorDescription)}`
    );
  }

  if (!code) {
    return NextResponse.redirect(
      `${origin}/recuperar?error=${encodeURIComponent('El enlace no es válido. Pide uno nuevo.')}`
    );
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);

  if (error) {
    return NextResponse.redirect(
      `${origin}/recuperar?error=${encodeURIComponent(
        'El enlace venció o ya se usó. Pide uno nuevo.'
      )}`
    );
  }

  return NextResponse.redirect(`${origin}/recuperar/nueva-clave`);
}
