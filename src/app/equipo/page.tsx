import { redirect } from 'next/navigation';
import AppHeader from '@/components/AppHeader';
import Aviso from '@/components/Aviso';
import InfoTip from '@/components/InfoTip';
import Seccion from '@/components/Seccion';
import { Boton } from '@/components/Campo';
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
      <div className="flex-1 max-w-3xl mx-auto w-full px-4 py-8 space-y-5">
        <div>
          <h1 className="text-xl font-semibold flex items-center gap-2">
            Equipo
            <InfoTip text="Las personas de tu organización que pueden ver y trabajar en los proyectos. Tú decides quién entra." />
          </h1>
          <p className="text-sm text-tinta-suave mt-1">{cliente?.name}</p>
        </div>

        {ok && <Aviso tipo="exito">{ok}</Aviso>}
        {error && <Aviso>{error}</Aviso>}

        {pendientes.length > 0 && (
          <Seccion titulo={`Solicitudes por aprobar (${pendientes.length})`}>
            <div className="space-y-2">
              {pendientes.map((m) => (
                <div
                  key={m.id}
                  className="flex flex-wrap items-center gap-3 border border-aviso/30 bg-aviso-fondo rounded-lg px-4 py-3"
                >
                  <div className="flex-1 min-w-[12rem] text-sm">
                    <div className="font-medium">{m.full_name || 'Sin nombre'}</div>
                    <div className="text-tinta-suave text-xs">
                      {m.email}
                      {m.job_title ? ` · ${m.job_title}` : ''}
                    </div>
                  </div>
                  <form action={resolverSolicitud.bind(null, m.id, true)}>
                    <Boton
                      type="submit"
                      className="bg-verde-oscuro hover:bg-exito text-white text-sm px-3 py-1.5"
                      variante="principal"
                    >
                      Aprobar
                    </Boton>
                  </form>
                  <form action={resolverSolicitud.bind(null, m.id, false)}>
                    <Boton type="submit" variante="secundario" className="text-sm px-3 py-1.5">
                      Rechazar
                    </Boton>
                  </form>
                </div>
              ))}
            </div>
          </Seccion>
        )}

        <Seccion titulo={`Con acceso (${activos.length})`}>
          <div className="space-y-2">
            {activos.map((m) => (
              <div
                key={m.id}
                className="flex flex-wrap items-center gap-3 border border-borde rounded-lg bg-elevado px-4 py-3"
              >
                <div className="flex-1 min-w-[12rem] text-sm">
                  <div className="font-medium flex items-center gap-2 flex-wrap">
                    {m.full_name || 'Sin nombre'}
                    {m.is_owner && (
                      <span className="text-[11px] px-1.5 py-0.5 rounded bg-azul/10 text-azul font-semibold">
                        Administra la cuenta
                      </span>
                    )}
                  </div>
                  <div className="text-tinta-suave text-xs">
                    {m.email}
                    {m.job_title ? ` · ${m.job_title}` : ''}
                  </div>
                </div>
                {!m.is_owner && (
                  <form action={quitarMiembro.bind(null, m.id)}>
                    <Boton type="submit" variante="texto" className="text-xs text-alerta">
                      Quitar acceso
                    </Boton>
                  </form>
                )}
              </div>
            ))}
          </div>
        </Seccion>

        <Aviso tipo="info">
          Para que alguien más de tu organización entre, dile que cree su cuenta en Jercol Hub y
          elija <b>&ldquo;Me uno a una ya registrada&rdquo;</b> con el NIT
          {cliente?.tax_id ? <span className="font-mono tracking-tight"> {cliente.tax_id}</span> : null}. Su solicitud te llegará aquí.
        </Aviso>
      </div>
    </>
  );
}
