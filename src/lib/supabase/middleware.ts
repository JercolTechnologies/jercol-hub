import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

/** Rutas para quien no ha entrado. Si ya tiene sesión, se le manda a la portada. */
const PUBLIC_PATHS = ['/login', '/signup'];

/**
 * Rutas abiertas en ambos sentidos: no exigen sesión, pero tampoco expulsan a
 * quien la tenga.
 *
 * La recuperación de contraseña necesita esto: el enlace del correo crea una
 * sesión temporal, así que si se tratara como ruta pública normal, el usuario
 * sería devuelto a la portada justo antes de poder escribir su clave nueva.
 */
const OPEN_PATHS = ['/recuperar'];

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet: { name: string; value: string; options: CookieOptions }[]) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const path = request.nextUrl.pathname;

  // Se resuelve antes que nada: aquí no se redirige en ninguna dirección.
  if (OPEN_PATHS.some((p) => path.startsWith(p))) {
    return supabaseResponse;
  }

  const isPublic = PUBLIC_PATHS.some((p) => path.startsWith(p));

  if (!user && !isPublic) {
    const url = request.nextUrl.clone();
    url.pathname = '/login';
    return NextResponse.redirect(url);
  }

  if (user && isPublic) {
    const url = request.nextUrl.clone();
    url.pathname = '/';
    return NextResponse.redirect(url);
  }

  return supabaseResponse;
}
