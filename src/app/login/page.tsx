import Link from 'next/link';
import { login } from './actions';

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;

  return (
    <div className="flex flex-1 items-center justify-center px-4">
      <div className="w-full max-w-sm bg-white rounded-lg shadow-sm border border-slate-200 p-6">
        <h1 className="text-lg font-semibold mb-1">Iniciar sesión</h1>
        <p className="text-sm text-slate-500 mb-5">Jercol Hub</p>

        {error && (
          <div className="mb-4 text-sm text-red-600 bg-red-50 border border-red-100 rounded px-3 py-2">
            {error}
          </div>
        )}

        <form action={login} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Correo</label>
            <input
              type="email"
              name="email"
              required
              className="w-full rounded border border-slate-300 px-3 py-2 text-sm"
              placeholder="tu@correo.com"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Contraseña</label>
            <input
              type="password"
              name="password"
              required
              className="w-full rounded border border-slate-300 px-3 py-2 text-sm"
              placeholder="••••••••"
            />
          </div>
          <button
            type="submit"
            className="w-full rounded bg-blue-600 text-white text-sm font-medium py-2 hover:bg-blue-700"
          >
            Entrar
          </button>
        </form>

        <p className="mt-4 text-sm text-slate-500 text-center">
          ¿No tienes cuenta?{' '}
          <Link href="/signup" className="text-blue-600 hover:underline">
            Regístrate
          </Link>
        </p>
      </div>
    </div>
  );
}
