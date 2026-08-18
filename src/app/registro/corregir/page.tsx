import { redirect } from 'next/navigation';
import Aviso from '@/components/Aviso';
import FileField from '@/components/FileField';
import Logo from '@/components/Logo';
import { createClient } from '@/lib/supabase/server';
import type { ClientRow, Profile } from '@/lib/types';
import { reenviarDocumentos } from './actions';

export const dynamic = 'force-dynamic';

export default async function CorregirPage({
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

  if (!profile?.client_id || !profile.is_owner) redirect('/');

  const { data: cliente } = await supabase
    .from('clients')
    .select('*')
    .eq('id', profile.client_id)
    .single<ClientRow>();

  if (!cliente || cliente.status !== 'rechazado') redirect('/');

  return (
    <div className="flex flex-1 justify-center px-4 py-10">
      <div className="w-full max-w-lg">
        <div className="mb-6">
          <Logo tamano="lg" />
        </div>

        <h1 className="text-xl font-semibold mb-1">Corregir el registro</h1>
        <p className="text-sm text-tinta-suave mb-4">{cliente.name}</p>

        <Aviso tipo="aviso" className="mb-5">
          <span className="block font-medium mb-1">Motivo del rechazo</span>
          {cliente.rejection_reason || 'No se indicó un motivo.'}
        </Aviso>

        {error && <Aviso className="mb-4">{error}</Aviso>}

        <form
          action={reenviarDocumentos}
          className="bg-tarjeta border border-borde rounded-xl p-5 sm:p-6 space-y-4"
        >
          <p className="text-sm text-tinta-suave">
            Adjunta solo lo que haga falta corregir. Los documentos anteriores se conservan.
          </p>

          <div>
            <div className="text-xs text-tinta mb-1">RUT</div>
            <FileField name="doc_rut" label="Adjuntar" />
          </div>
          <div>
            <div className="text-xs text-tinta mb-1">Cédula — cara frontal</div>
            <FileField name="doc_cedula" label="Adjuntar" />
          </div>
          <div>
            <div className="text-xs text-tinta mb-1">Cédula — reverso</div>
            <FileField name="doc_cedula_reverso" label="Adjuntar" />
          </div>
          {cliente.kind === 'juridica' && (
            <div>
              <div className="text-xs text-tinta mb-1">Cámara de Comercio</div>
              <FileField name="doc_camara" label="Adjuntar" />
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-tinta-suave mb-1">
              Aclaración (opcional)
            </label>
            <textarea
              name="nota"
              className="w-full rounded border border-borde px-3 py-2 text-sm min-h-[70px]"
              placeholder="Si hay algo que explicar sobre los documentos, escríbelo aquí."
            />
          </div>

          <button
            type="submit"
            className="w-full rounded bg-azul text-white text-sm font-medium py-2 hover:bg-azul-oscuro cursor-pointer"
          >
            Reenviar para revisión
          </button>
        </form>

        <form action="/logout" method="post" className="mt-6 text-center">
          <button className="text-sm text-tinta-suave hover:underline cursor-pointer" type="submit">
            Cerrar sesión
          </button>
        </form>
      </div>
    </div>
  );
}
