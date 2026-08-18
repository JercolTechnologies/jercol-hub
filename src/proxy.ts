import { type NextRequest } from 'next/server';
import { updateSession } from '@/lib/supabase/middleware';

export async function proxy(request: NextRequest) {
  return await updateSession(request);
}

export const config = {
  matcher: [
    // Qué queda FUERA de la comprobación de sesión, y por qué:
    //
    // - `api`: son webhooks que llaman Telegram y Supabase, sin sesión de
    //   usuario. Si pasaran por aquí, el proxy los redirigiría a /login y
    //   nunca se ejecutarían. Cada ruta de /api valida su propio secreto.
    //
    // - `marca`: los archivos de marca en public/marca. Va por carpeta y no
    //   por extensión a propósito. La lista de extensiones de abajo venía del
    //   ejemplo de Supabase y solo cubría imágenes, así que al añadir un vídeo
    //   el proxy lo interceptó y respondió con una redirección a /login: el
    //   elemento <video> recibía HTML en vez de un MP4 y fallaba con
    //   "no supported source was found", que no apunta a nada parecido a la
    //   causa real. Excluyendo la carpeta, cualquier archivo que se ponga ahí
    //   funciona sin acordarse de tocar este archivo.
    //
    // - Las extensiones: se mantienen para lo que viva suelto en public/.
    '/((?!api|marca|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|avif|ico|mp4|webm|woff|woff2)$).*)',
  ],
};
