import { redirect } from 'next/navigation';
import FileField from '@/components/FileField';
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
        <h1 className="text-xl font-semibold mb-1">Corregir el registro</h1>
        <p className="text-sm text-slate-500 mb-4">{cliente.name}</p>

        <div className="text-sm bg-amber-50 text-amber-900 rounded px-3 py-3 mb-6">
          <div className="font-medium mb-1">Motivo del rechazo</div>
          {cliente.rejection_reason || 'No se indicó un motivo.'}
        </div>

        {error && (
          <div className="mb-4 text-sm text-red-600 bg-red-50 border border-red-100 rounded px-3 py-2">
            {error}
          </div>
        )}

        <form
          action={reenviarDocumentos}
          className="bg-white border border-slate-200 rounded-lg p-5 space-y-4"
        >
          <p className="text-sm text-slate-500">
            Adjunta solo lo que haga falta corregir. Los documentos anteriores se conservan.
          </p>

          <div>
            <div className="text-xs text-slate-600 mb-1">RUT</div>
            <FileField name="doc_rut" label="Adjuntar" />
          </div>
          <div>
            <div className="text-xs text-slate-600 mb-1">Cédula — cara frontal</div>
            <FileField name="doc_cedula" label="Adjuntar" />
          </div>
          <div>
            <div className="text-xs text-slate-600 mb-1">Cédula — reverso</div>
            <FileField name="doc_cedula_reverso" label="Adjuntar" />
          </div>
          {cliente.kind === 'juridica' && (
            <div>
              <div className="text-xs text-slate-600 mb-1">Cámara de Comercio</div>
              <FileField name="doc_camara" label="Adjuntar" />
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-slate-500 mb-1">
              Aclaración (opcional)
            </label>
            <textarea
              name="nota"
              className="w-full rounded border border-slate-300 px-3 py-2 text-sm min-h-[70px]"
              placeholder="Si hay algo que explicar sobre los documentos, escríbelo aquí."
            />
          </div>

          <button
            type="submit"
            className="w-full rounded bg-blue-600 text-white text-sm font-medium py-2 hover:bg-blue-700 cursor-pointer"
          >
            Reenviar para revisión
          </button>
        </form>

        <form action="/logout" method="post" className="mt-6 text-center">
          <button className="text-sm text-slate-500 hover:underline cursor-pointer" type="submit">
            Cerrar sesión
          </button>
        </form>
      </div>
    </div>
  );
}
