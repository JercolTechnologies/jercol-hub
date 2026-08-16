import Link from 'next/link';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import type { Profile } from '@/lib/types';
import { unirmeAEmpresa } from '../actions';

export const dynamic = 'force-dynamic';

export default async function UnirmePage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single<Profile>();

  if (profile?.client_id) redirect('/');

  return (
    <div className="flex flex-1 justify-center px-4 py-10">
      <div className="w-full max-w-md">
        <Link href="/registro" className="text-sm text-slate-500 hover:underline">
          ← Volver
        </Link>

        <h1 className="text-xl font-semibold mt-4 mb-1">Unirme a una organización</h1>
        <p className="text-sm text-slate-500 mb-6">
          Quien registró la organización recibirá tu solicitud y la aprobará.
        </p>

        {error && (
          <div className="mb-4 text-sm text-red-600 bg-red-50 border border-red-100 rounded px-3 py-2">
            {error}
          </div>
        )}

        <form action={unirmeAEmpresa} className="bg-white border border-slate-200 rounded-lg p-5 space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-500 mb-1">
              NIT de la organización
            </label>
            <input
              type="text"
              name="tax_id"
              required
              className="w-full rounded border border-slate-300 px-3 py-2 text-sm"
              placeholder="900123456-7"
            />
            <p className="text-[11px] text-slate-400 mt-1">
              Pídeselo a quien registró la cuenta de tu organización. Puedes escribirlo con
              puntos y guion o sin ellos.
            </p>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-500 mb-1">Tu cargo</label>
            <input
              type="text"
              name="job_title"
              required
              className="w-full rounded border border-slate-300 px-3 py-2 text-sm"
              placeholder="CTO, asistente, coordinadora…"
            />
          </div>

          <button
            type="submit"
            className="w-full rounded bg-blue-600 text-white text-sm font-medium py-2 hover:bg-blue-700 cursor-pointer"
          >
            Enviar solicitud
          </button>
        </form>
      </div>
    </div>
  );
}
