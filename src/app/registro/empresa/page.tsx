import Link from 'next/link';
import { redirect } from 'next/navigation';
import RegistroEmpresaForm from '@/components/RegistroEmpresaForm';
import { createClient } from '@/lib/supabase/server';
import type { Profile } from '@/lib/types';
import { registrarEmpresa } from '../actions';

export const dynamic = 'force-dynamic';

export default async function RegistroEmpresaPage({
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
      <div className="w-full max-w-lg">
        {/* Con ?elegir=1, porque /registro a secas vuelve a enrutar aquí según
            el camino elegido al crear la cuenta, y sería un bucle. */}
        <Link href="/registro?elegir=1" className="text-sm text-slate-500 hover:underline">
          ← Esto no es lo que buscaba
        </Link>

        <h1 className="text-xl font-semibold mt-4 mb-1">Registrar organización</h1>
        <p className="text-sm text-slate-500 mb-6">
          Con esto verificamos con quién estamos contratando. Lo revisamos y te habilitamos.
        </p>

        {error && (
          <div className="mb-4 text-sm text-red-600 bg-red-50 border border-red-100 rounded px-3 py-2">
            {error}
          </div>
        )}

        <div className="bg-white border border-slate-200 rounded-lg p-5">
          <RegistroEmpresaForm action={registrarEmpresa} />
        </div>
      </div>
    </div>
  );
}
