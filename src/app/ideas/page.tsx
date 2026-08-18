import Link from 'next/link';
import { redirect } from 'next/navigation';
import AppHeader from '@/components/AppHeader';
import Aviso from '@/components/Aviso';
import Etiqueta, { type TonoEtiqueta } from '@/components/Etiqueta';
import Seccion from '@/components/Seccion';
import { Boton, claseInput } from '@/components/Campo';
import { createClient } from '@/lib/supabase/server';
import type { Profile, ProjectIdea, IdeaStatus } from '@/lib/types';
import { createIdea } from './actions';

const STATUS_LABEL: Record<IdeaStatus, string> = {
  nueva: 'Nueva',
  en_conversacion: 'En conversación',
  convertida: 'Convertida en proyecto',
  descartada: 'Descartada',
};

const STATUS_TONO: Record<IdeaStatus, TonoEtiqueta> = {
  nueva: 'azul',
  en_conversacion: 'ambar',
  convertida: 'verde',
  descartada: 'neutro',
};

export default async function IdeasPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  // En paralelo: RLS ya limita las ideas a las del cliente del usuario.
  const [{ data: profile }, { data: ideas }] = await Promise.all([
    supabase.from('profiles').select('*').eq('id', user.id).single<Profile>(),
    supabase
      .from('project_ideas')
      .select('*, clients(name)')
      .order('created_at', { ascending: false })
      .returns<ProjectIdea[]>(),
  ]);

  if (!profile) redirect('/login');

  const isAdmin = profile.role === 'admin';

  return (
    <>
      <AppHeader isAdmin={isAdmin} isOwner={profile.is_owner} />
      <div className="flex-1 max-w-3xl mx-auto w-full px-4 py-8 space-y-5">
        <div>
          <h1 className="text-xl font-semibold">Ideas de proyecto</h1>
          <p className="text-sm text-tinta-suave mt-1">
            Espacio separado del tablero de tareas, para proponer y conversar sobre proyectos
            nuevos antes de que se formalicen.
          </p>
        </div>

        {!isAdmin && profile.client_id && (
          <Seccion titulo="Nueva idea">
            <form action={createIdea} className="space-y-3">
              <input
                type="text"
                name="title"
                required
                placeholder="Título de la idea"
                className={claseInput}
              />
              <textarea
                name="description"
                placeholder="Cuéntanos de qué se trata..."
                className={`${claseInput} min-h-[80px]`}
              />
              <Boton type="submit">Enviar idea</Boton>
            </form>
          </Seccion>
        )}

        {(!ideas || ideas.length === 0) && (
          <Aviso tipo="info">
            Todavía no hay ideas registradas.
            {!isAdmin && ' Cuéntanos la primera con el formulario de arriba.'}
          </Aviso>
        )}

        <div className="space-y-2">
          {ideas?.map((idea) => (
            <Link
              key={idea.id}
              href={`/ideas/${idea.id}`}
              className="block bg-tarjeta border border-borde rounded-xl px-4 py-3.5 hover:border-azul hover:shadow-sm transition-all"
            >
              <div className="flex items-center justify-between gap-3">
                <span className="font-medium text-sm">{idea.title}</span>
                <Etiqueta tono={STATUS_TONO[idea.status]}>{STATUS_LABEL[idea.status]}</Etiqueta>
              </div>
              {isAdmin && idea.clients?.name && (
                <div className="text-xs text-tinta-suave mt-1">{idea.clients.name}</div>
              )}
            </Link>
          ))}
        </div>
      </div>
    </>
  );
}
