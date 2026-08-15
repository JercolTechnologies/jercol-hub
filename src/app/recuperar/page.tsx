import Link from 'next/link';
import { pedirRecuperacion } from './actions';

export default async function RecuperarPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; enviado?: string }>;
}) {
  const { error, enviado } = await searchParams;

  return (
    <div className="flex flex-1 items-center justify-center px-4">
      <div className="w-full max-w-sm bg-white rounded-lg shadow-sm border border-slate-200 p-6">
        <h1 className="text-lg font-semibold mb-1">Recuperar contraseña</h1>
        <p className="text-sm text-slate-500 mb-5">
          Te enviamos un enlace al correo para que puedas crear una nueva.
        </p>

        {error && (
          <div className="mb-4 text-sm text-red-600 bg-red-50 border border-red-100 rounded px-3 py-2">
            {error}
          </div>
        )}

        {enviado ? (
          <div className="text-sm bg-emerald-50 text-emerald-800 rounded px-3 py-3 mb-4">
            Si ese correo tiene una cuenta, ya va en camino el enlace. Revisa también la carpeta
            de spam.
            <div className="text-xs text-emerald-700 mt-2">El enlace vence en una hora.</div>
          </div>
        ) : (
          <form action={pedirRecuperacion} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Correo</label>
              <input
                type="email"
                name="email"
                required
                autoComplete="email"
                className="w-full rounded border border-slate-300 px-3 py-2 text-sm"
                placeholder="tu@correo.com"
              />
            </div>
            <button
              type="submit"
              className="w-full rounded bg-blue-600 text-white text-sm font-medium py-2 hover:bg-blue-700 cursor-pointer"
            >
              Enviar enlace
            </button>
          </form>
        )}

        <p className="mt-4 text-sm text-slate-500 text-center">
          <Link href="/login" className="text-blue-600 hover:underline">
            Volver a iniciar sesión
          </Link>
        </p>
      </div>
    </div>
  );
}
