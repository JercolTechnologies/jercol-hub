import 'server-only';

import { createClient } from '@supabase/supabase-js';

/**
 * Cliente con la service role key: SALTA TODAS LAS POLÍTICAS RLS.
 *
 * Se usa solo para operaciones que el sistema debe hacer en su propio
 * nombre y no en el del usuario — en concreto, registrar firmas y escribir
 * el PDF final en Storage (el bucket solo admite escritura del admin, pero
 * la segunda firma la dispara el cliente).
 *
 * El import de 'server-only' hace que el build falle si alguien intenta
 * importar este archivo desde un componente de cliente. Nunca debe llegar
 * al navegador: la clave no lleva prefijo NEXT_PUBLIC_ justamente por eso.
 *
 * Toda función que lo use tiene que verificar identidad y permisos por su
 * cuenta antes, porque aquí la base de datos ya no protege nada.
 */
export function createAdminClient() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) {
    throw new Error(
      'Falta SUPABASE_SERVICE_ROLE_KEY. Agrégala en .env.local y en las variables de entorno de Vercel.'
    );
  }

  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
