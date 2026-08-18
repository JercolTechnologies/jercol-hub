import Link from 'next/link';
import { redirect } from 'next/navigation';
import AuthShell from '@/components/AuthShell';
import Aviso from '@/components/Aviso';
import { Boton, Campo, claseInput } from '@/components/Campo';
import { createClient } from '@/lib/supabase/server';
import { guardarNuevaClave } from '../actions';

export const dynamic = 'force-dynamic';

export default async function NuevaClavePage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;

  // Solo se llega aquí con la sesión temporal que crea el enlace del correo.
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect(
      '/recuperar?error=' + encodeURIComponent('El enlace venció o ya se usó. Pide uno nuevo.')
    );
  }

  return (
    <AuthShell titulo="Nueva contraseña" descripcion={`Para ${user.email}`}>
      {error && <Aviso className="mb-4">{error}</Aviso>}

      <form action={guardarNuevaClave} className="space-y-4">
        <Campo etiqueta="Nueva contraseña">
          <input
            type="password"
            name="password"
            required
            minLength={6}
            autoComplete="new-password"
            className={claseInput}
            placeholder="Mínimo 6 caracteres"
          />
        </Campo>

        <Campo etiqueta="Repítela">
          <input
            type="password"
            name="password_repeat"
            required
            minLength={6}
            autoComplete="new-password"
            className={claseInput}
          />
        </Campo>

        <Boton type="submit" ancho>
          Guardar contraseña
        </Boton>
      </form>

      <p className="mt-4 text-sm text-tinta-suave text-center">
        <Link href="/login" className="text-azul hover:underline underline-offset-2">
          Cancelar
        </Link>
      </p>
    </AuthShell>
  );
}
