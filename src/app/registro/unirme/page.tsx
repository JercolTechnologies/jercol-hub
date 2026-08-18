import Link from 'next/link';
import { redirect } from 'next/navigation';
import Aviso from '@/components/Aviso';
import Logo from '@/components/Logo';
import Seccion from '@/components/Seccion';
import { Boton, Campo, claseInput } from '@/components/Campo';
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
        <div className="mb-6">
          <Logo tamano="lg" />
        </div>

        {/* Con ?elegir=1, porque /registro a secas vuelve a enrutar aquí según
            el camino elegido al crear la cuenta, y sería un bucle. */}
        <Link href="/registro?elegir=1" className="text-sm text-tinta-suave hover:text-tinta">
          ← Esto no es lo que buscaba
        </Link>

        <h1 className="text-xl font-semibold mt-4 mb-1">Unirme a una organización</h1>
        <p className="text-sm text-tinta-suave mb-5">
          Quien registró la organización recibirá tu solicitud y la aprobará.
        </p>

        {error && <Aviso className="mb-4">{error}</Aviso>}

        <Seccion>
          <form action={unirmeAEmpresa} className="space-y-4">
            <Campo
              etiqueta="NIT de la organización"
              ayuda="Pídeselo a quien registró la cuenta de tu organización. Puedes escribirlo con puntos y guion o sin ellos."
            >
              <input
                type="text"
                name="tax_id"
                required
                className={claseInput}
                placeholder="900123456-7"
              />
            </Campo>

            <Campo etiqueta="Tu cargo">
              <input
                type="text"
                name="job_title"
                required
                className={claseInput}
                placeholder="CTO, asistente, coordinadora…"
              />
            </Campo>

            <Boton type="submit" ancho>
              Enviar solicitud
            </Boton>
          </form>
        </Seccion>
      </div>
    </div>
  );
}
