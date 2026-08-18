import Link from 'next/link';
import AuthShell from '@/components/AuthShell';
import Aviso from '@/components/Aviso';
import { Boton, Campo, claseInput } from '@/components/Campo';
import { login } from './actions';

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;

  return (
    <AuthShell titulo="Iniciar sesión">
      {error && <Aviso className="mb-4">{error}</Aviso>}

      <form action={login} className="space-y-4">
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

        <Campo etiqueta="Contraseña">
          <input
            type="password"
            name="password"
            required
            autoComplete="current-password"
            className={claseInput}
            placeholder="••••••••"
          />
        </Campo>

        <Boton type="submit" ancho>
          Entrar
        </Boton>
      </form>

      <p className="mt-4 text-sm text-center">
        <Link href="/recuperar" className="text-tinta-suave hover:text-tinta">
          ¿Olvidaste tu contraseña?
        </Link>
      </p>

      <p className="mt-3 text-sm text-tinta-suave text-center">
        ¿No tienes cuenta?{' '}
        <Link href="/signup" className="text-azul hover:underline underline-offset-2">
          Regístrate
        </Link>
      </p>
    </AuthShell>
  );
}
