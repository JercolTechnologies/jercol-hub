import Link from 'next/link';
import { redirect } from 'next/navigation';
import Aviso from '@/components/Aviso';
import Logo from '@/components/Logo';
import Seccion from '@/components/Seccion';
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
        <div className="mb-6">
          <Logo tamano="lg" />
        </div>

        {/* Con ?elegir=1, porque /registro a secas vuelve a enrutar aquí según
            el camino elegido al crear la cuenta, y sería un bucle. */}
        <Link href="/registro?elegir=1" className="text-sm text-tinta-suave hover:text-tinta">
          ← Esto no es lo que buscaba
        </Link>

        <h1 className="text-xl font-semibold mt-4 mb-1">Registrar organización</h1>
        <p className="text-sm text-tinta-suave mb-5">
          Con esto verificamos con quién estamos contratando. Lo revisamos y te habilitamos.
        </p>

        {error && <Aviso className="mb-4">{error}</Aviso>}

        <Seccion>
          <RegistroEmpresaForm action={registrarEmpresa} />
        </Seccion>
      </div>
    </div>
  );
}
