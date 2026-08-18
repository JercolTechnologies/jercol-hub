import Link from 'next/link';
import AuthShell from '@/components/AuthShell';
import Aviso from '@/components/Aviso';
import { Boton, Campo, claseInput } from '@/components/Campo';
import { pedirRecuperacion } from './actions';

export default async function RecuperarPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; enviado?: string }>;
}) {
  const { error, enviado } = await searchParams;

  return (
    <AuthShell
      titulo="Recuperar contraseña"
      descripcion="Te enviamos un enlace al correo para que puedas crear una nueva."
    >
      {error && <Aviso className="mb-4">{error}</Aviso>}

      {enviado ? (
        <Aviso tipo="exito">
          Si ese correo tiene una cuenta, ya va en camino el enlace. Revisa también la carpeta
          de spam.
          <span className="block text-xs mt-1.5 opacity-80">El enlace vence en una hora.</span>
        </Aviso>
      ) : (
        <form action={pedirRecuperacion} className="space-y-4">
          <Campo etiqueta="Correo">
            <input
              type="email"
              name="email"
              required
              autoComplete="email"
              className={claseInput}
              placeholder="tu@correo.com"
            />
          </Campo>

          <Boton type="submit" ancho>
            Enviar enlace
          </Boton>
        </form>
      )}

      <p className="mt-4 text-sm text-tinta-suave text-center">
        <Link href="/login" className="text-azul hover:underline underline-offset-2">
          Volver a iniciar sesión
        </Link>
      </p>
    </AuthShell>
  );
}
