import { type NextRequest } from 'next/server';
import { updateSession } from '@/lib/supabase/middleware';

export async function proxy(request: NextRequest) {
  return await updateSession(request);
}

export const config = {
  matcher: [
    // Se excluye /api a propósito: son webhooks que llaman Telegram y Supabase,
    // sin sesión de usuario. Si pasaran por aquí, el proxy los redirigiría a
    // /login y nunca se ejecutarían. Cada ruta de /api valida su propio secreto.
    '/((?!api|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
