import { redirect } from 'next/navigation';
import AppHeader from '@/components/AppHeader';
import InfoTip from '@/components/InfoTip';
import { createClient } from '@/lib/supabase/server';
import type { ClientRow, Profile } from '@/lib/types';
import { resolverSolicitud, quitarMiembro } from './actions';

export const dynamic = 'force-dynamic';

export default async function EquipoPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; ok?: string }>;
}) {
  const { error, ok } = await searchParams;
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

  if (!profile?.is_owner || !profile.client_id) redirect('/');

  const [{ data: miembros }, { data: cliente }] = await Promise.all([
    supabase
      .from('profiles')
      .select('*')
      .eq('client_id', profile.client_id)
      .order('created_at', { ascending: true })
      .returns<Profile[]>(),
    supabase.from('clients').select('*').eq('id', profile.client_id).single<ClientRow>(),
  ]);

  const lista = miembros || [];
  const pendientes = lista.filter((m) => m.member_status === 'pendiente');
  const activos = lista.filter((m) => m.member_status === 'activo');

  return (
    <>
      <AppHeader isAdmin={false} isOwner />
      <div className="flex-1 max-w-3xl mx-auto w-full px-4 py-8">
        <h1 className="text-xl font-semibold mb-1 flex items-center gap-2">
          Equipo
          <InfoTip text="Las personas de tu organización que pueden ver y trabajar en los proyectos. Tú decides quién entra." />
        </h1>
        <p className="text-sm text-slate-500 mb-6">{cliente?.name}</p>

        {ok && (
          <div className="mb-4 text-sm text-emerald-800 bg-emerald-50 border border-emerald-100 rounded px-3 py-2">
            {ok}
          </div>
        )}
        {error && (
          <div className="mb-4 text-sm text-red-600 bg-red-50 border border-red-100 rounded px-3 py-2">
            {error}
          </div>
        )}

        {pendientes.length > 0 && (
          <section className="mb-8">
            <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wide mb-3">
              Solicitudes por aprobar ({pendientes.length})
            </h2>
            <div className="space-y-2">
              {pendientes.map((m) => (
                <div
                  key={m.id}
                  className="flex items-center gap-3 bg-white border border-amber-200 rounded-lg px-4 py-3"
                >
                  <div className="flex-1 text-sm">
                    <div className="font-medium">{m.full_name || 'Sin nombre'}</div>
                    <div className="text-slate-500 text-xs">
                      {m.email}
                      {m.job_title ? ` · ${m.job_title}` : ''}
                    </div>
                  </div>
                  <form action={resolverSolicitud.bind(null, m.id, true)}>
                    <button className="text-sm px-3 py-1.5 rounded bg-emerald-600 text-white hover:bg-emerald-700 cursor-pointer">
                      Aprobar
                    </button>
                  </form>
                  <form action={resolverSolicitud.bind(null, m.id, false)}>
                    <button className="text-sm px-3 py-1.5 rounded border border-slate-300 hover:bg-slate-50 cursor-pointer">
                      Rechazar
                    </button>
                  </form>
                </div>
              ))}
            </div>
          </section>
        )}

        <section>
          <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wide mb-3">
            Con acceso ({activos.length})
          </h2>
          <div className="space-y-2">
            {activos.map((m) => (
              <div
                key={m.id}
                className="flex items-center gap-3 bg-white border border-slate-200 rounded-lg px-4 py-3"
              >
                <div className="flex-1 text-sm">
                  <div className="font-medium flex items-center gap-2">
                    {m.full_name || 'Sin nombre'}
                    {m.is_owner && (
                      <span className="text-[11px] px-1.5 py-0.5 rounded bg-blue-50 text-blue-700 font-semibold">
                        Administra la cuenta
                      </span>
                    )}
                  </div>
                  <div className="text-slate-500 text-xs">
                    {m.email}
                    {m.job_title ? ` · ${m.job_title}` : ''}
                  </div>
                </div>
                {!m.is_owner && (
                  <form action={quitarMiembro.bind(null, m.id)}>
                    <button className="text-xs text-red-600 hover:underline cursor-pointer">
                      Quitar acceso
                    </button>
                  </form>
                )}
              </div>
            ))}
          </div>
        </section>

        <div className="text-xs text-slate-400 mt-8 bg-slate-50 rounded p-3">
          Para que alguien más de tu organización entre, dile que cree su cuenta en Jercol Hub y
          elija <b>&ldquo;Unirme a una organización ya registrada&rdquo;</b> con el NIT
          {cliente?.tax_id ? ` ${cliente.tax_id}` : ''}. Su solicitud te llegará aquí.
        </div>
      </div>
    </>
  );
}
