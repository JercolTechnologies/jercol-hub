import { redirect } from 'next/navigation';
import AppHeader from '@/components/AppHeader';
import InfoTip from '@/components/InfoTip';
import TelegramConnect from '@/components/TelegramConnect';
import { createClient } from '@/lib/supabase/server';
import type { Profile } from '@/lib/types';
import { crearEnlaceTelegram, desconectarTelegram, cambiarAvisos } from './actions';

export const dynamic = 'force-dynamic';

export default async function PerfilPage() {
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
  if (!profile) redirect('/login');

  const isAdmin = profile.role === 'admin';
  const conectado = !!profile.telegram_chat_id;

  return (
    <>
      <AppHeader isAdmin={isAdmin} />
      <div className="flex-1 max-w-2xl mx-auto w-full px-4 py-8">
        <h1 className="text-xl font-semibold mb-6">Tu perfil</h1>

        <section className="bg-white border border-slate-200 rounded-lg p-5 mb-6">
          <div className="text-sm">
            <div className="font-medium">{profile.full_name || 'Sin nombre'}</div>
            <div className="text-slate-500">{profile.email}</div>
          </div>
        </section>

        <section className="bg-white border border-slate-200 rounded-lg p-5">
          <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wide mb-1 flex items-center gap-1.5">
            Avisos por Telegram
            <InfoTip text="Te escribimos cuando pasa algo que te concierne: un comentario nuevo, un cambio de estado, un contrato listo para revisar o firmar." />
          </h2>
          <p className="text-sm text-slate-500 mb-4">
            Recibe un mensaje cuando haya novedades, sin tener que entrar a revisar.
          </p>

          {!conectado ? (
            <TelegramConnect crearEnlace={crearEnlaceTelegram} />
          ) : (
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-sm">
                <span className="inline-block w-2 h-2 rounded-full bg-emerald-500" />
                Telegram conectado
              </div>

              <form action={cambiarAvisos.bind(null, !profile.telegram_enabled)}>
                <button
                  type="submit"
                  className="text-sm px-3 py-1.5 rounded border border-slate-300 hover:bg-slate-50 cursor-pointer"
                >
                  {profile.telegram_enabled ? 'Pausar avisos' : 'Reanudar avisos'}
                </button>
              </form>

              {!profile.telegram_enabled && (
                <div className="text-xs bg-amber-50 text-amber-800 rounded px-3 py-2">
                  Los avisos están pausados. Sigues conectado, pero no te escribimos.
                </div>
              )}

              <form action={desconectarTelegram}>
                <button type="submit" className="text-xs text-red-600 hover:underline cursor-pointer">
                  Desconectar Telegram
                </button>
              </form>
            </div>
          )}
        </section>
      </div>
    </>
  );
}
