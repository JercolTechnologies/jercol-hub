import Link from 'next/link';
import { signup } from './actions';

export default async function SignupPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;

  return (
    <div className="flex flex-1 items-center justify-center px-4">
      <div className="w-full max-w-sm bg-white rounded-lg shadow-sm border border-slate-200 p-6">
        <h1 className="text-lg font-semibold mb-1">Crear cuenta</h1>
        <p className="text-sm text-slate-500 mb-5">Jercol Hub</p>

        {error && (
          <div className="mb-4 text-sm text-red-600 bg-red-50 border border-red-100 rounded px-3 py-2">
            {error}
          </div>
        )}

        <form action={signup} className="space-y-4">
          <fieldset>
            <legend className="block text-xs font-medium text-slate-600 mb-2">
              ¿Cuál es tu caso?
            </legend>
            <div className="space-y-2">
              <label className="flex gap-3 items-start border border-slate-200 rounded-lg p-3 cursor-pointer hover:border-blue-400 has-[:checked]:border-blue-500 has-[:checked]:bg-blue-50/50">
                <input
                  type="radio"
                  name="camino"
                  value="empresa"
                  defaultChecked
                  className="mt-0.5 cursor-pointer"
                />
                <span className="text-sm">
                  <span className="font-medium block">Registro mi organización</span>
                  <span className="text-slate-500 text-xs">
                    Eres el primero de tu empresa, o trabajas como persona natural. Ten a mano
                    el RUT y la cédula.
                  </span>
                </span>
              </label>

              <label className="flex gap-3 items-start border border-slate-200 rounded-lg p-3 cursor-pointer hover:border-blue-400 has-[:checked]:border-blue-500 has-[:checked]:bg-blue-50/50">
                <input type="radio" name="camino" value="unirme" className="mt-0.5 cursor-pointer" />
                <span className="text-sm">
                  <span className="font-medium block">Me uno a una ya registrada</span>
                  <span className="text-slate-500 text-xs">
                    Alguien de tu empresa la registró antes. Solo necesitas su NIT.
                  </span>
                </span>
              </label>
            </div>
          </fieldset>

          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Nombre</label>
            <input
              type="text"
              name="full_name"
              required
              className="w-full rounded border border-slate-300 px-3 py-2 text-sm"
              placeholder="Tu nombre"
            />
          </div>
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
              minLength={6}
              className="w-full rounded border border-slate-300 px-3 py-2 text-sm"
              placeholder="Mínimo 6 caracteres"
            />
          </div>
          <button
            type="submit"
            className="w-full rounded bg-blue-600 text-white text-sm font-medium py-2 hover:bg-blue-700"
          >
            Crear cuenta
          </button>
        </form>

        <p className="mt-4 text-sm text-slate-500 text-center">
          ¿Ya tienes cuenta?{' '}
          <Link href="/login" className="text-blue-600 hover:underline">
            Inicia sesión
          </Link>
        </p>
      </div>
    </div>
  );
}
