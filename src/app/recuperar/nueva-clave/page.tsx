import Link from 'next/link';
import { redirect } from 'next/navigation';
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
    <div className="flex flex-1 items-center justify-center px-4">
      <div className="w-full max-w-sm bg-white rounded-lg shadow-sm border border-slate-200 p-6">
        <h1 className="text-lg font-semibold mb-1">Nueva contraseña</h1>
        <p className="text-sm text-slate-500 mb-5">Para {user.email}</p>

        {error && (
          <div className="mb-4 text-sm text-red-600 bg-red-50 border border-red-100 rounded px-3 py-2">
            {error}
          </div>
        )}

        <form action={guardarNuevaClave} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">
              Nueva contraseña
            </label>
            <input
              type="password"
              name="password"
              required
              minLength={6}
              autoComplete="new-password"
              className="w-full rounded border border-slate-300 px-3 py-2 text-sm"
              placeholder="Mínimo 6 caracteres"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Repítela</label>
            <input
              type="password"
              name="password_repeat"
              required
              minLength={6}
              autoComplete="new-password"
              className="w-full rounded border border-slate-300 px-3 py-2 text-sm"
            />
          </div>
          <button
            type="submit"
            className="w-full rounded bg-blue-600 text-white text-sm font-medium py-2 hover:bg-blue-700 cursor-pointer"
          >
            Guardar contraseña
          </button>
        </form>

        <p className="mt-4 text-sm text-slate-500 text-center">
          <Link href="/login" className="text-blue-600 hover:underline">
            Cancelar
          </Link>
        </p>
      </div>
    </div>
  );
}
