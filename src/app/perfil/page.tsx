import { redirect } from 'next/navigation';
import AppHeader from '@/components/AppHeader';
import Aviso from '@/components/Aviso';
import Seccion from '@/components/Seccion';
import TelegramConnect from '@/components/TelegramConnect';
import { Boton, Campo, claseInput } from '@/components/Campo';
import { createClient } from '@/lib/supabase/server';
import type { Profile } from '@/lib/types';
import { crearEnlaceTelegram, desconectarTelegram, cambiarAvisos, cambiarClave } from './actions';

export const dynamic = 'force-dynamic';

export default async function PerfilPage({
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
  if (!profile) redirect('/login');

  const isAdmin = profile.role === 'admin';
  const conectado = !!profile.telegram_chat_id;

  return (
    <>
      <AppHeader isAdmin={isAdmin} isOwner={profile.is_owner} />
      <div className="flex-1 max-w-2xl mx-auto w-full px-4 py-8 space-y-5">
        <h1 className="text-xl font-semibold">Tu perfil</h1>

        {ok && <Aviso tipo="exito">{ok}</Aviso>}
        {error && <Aviso>{error}</Aviso>}

        <Seccion>
          <div className="text-sm">
            <div className="font-medium">{profile.full_name || 'Sin nombre'}</div>
            <div className="text-tinta-suave">{profile.email}</div>
          </div>
        </Seccion>

        <Seccion titulo="Cambiar contraseña">
          <form action={cambiarClave} className="space-y-3 max-w-sm">
            <Campo etiqueta="Nueva contraseña">
              <input
                type="password"
                name="password"
                required
                minLength={6}
                autoComplete="new-password"
                className={claseInput}
                placeholder="Mínimo 6 caracteres"
              />
            </Campo>

            <Campo etiqueta="Repítela">
              <input
                type="password"
                name="password_repeat"
                required
                minLength={6}
                autoComplete="new-password"
                className={claseInput}
              />
            </Campo>

            <Boton type="submit" variante="secundario">
              Guardar contraseña
            </Boton>
          </form>
        </Seccion>

        <Seccion
          titulo="Avisos por Telegram"
          ayuda="Te escribimos cuando pasa algo que te concierne: un comentario nuevo, un cambio de estado, un contrato listo para revisar o firmar."
          descripcion="Recibe un mensaje cuando haya novedades, sin tener que entrar a revisar."
        >
          {!conectado ? (
            <TelegramConnect crearEnlace={crearEnlaceTelegram} />
          ) : (
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-sm">
                <span className="inline-block w-2 h-2 rounded-full bg-verde-oscuro" />
                Telegram conectado
              </div>

              <form action={cambiarAvisos.bind(null, !profile.telegram_enabled)}>
                <Boton type="submit" variante="secundario">
                  {profile.telegram_enabled ? 'Pausar avisos' : 'Reanudar avisos'}
                </Boton>
              </form>

              {!profile.telegram_enabled && (
                <Aviso tipo="aviso">
                  Los avisos están pausados. Sigues conectado, pero no te escribimos.
                </Aviso>
              )}

              <form action={desconectarTelegram}>
                <Boton type="submit" variante="texto" className="text-xs text-alerta">
                  Desconectar Telegram
                </Boton>
              </form>
            </div>
          )}
        </Seccion>
      </div>
    </>
  );
}
