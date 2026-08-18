import Link from 'next/link';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import type { Profile, ProjectIdea, ProjectIdeaComment, IdeaStatus } from '@/lib/types';
import { addIdeaComment, setIdeaStatus, convertIdeaToProject } from '../actions';
import AppHeader from '@/components/AppHeader';
import Etiqueta, { type TonoEtiqueta } from '@/components/Etiqueta';
import IdeaAttachments from '@/components/IdeaAttachments';
import Seccion from '@/components/Seccion';
import { Boton, claseInput } from '@/components/Campo';

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

export default async function IdeaDetailPage({
  params,
}: {
  params: Promise<{ ideaId: string }>;
}) {
  const { ideaId } = await params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  // Ninguna de las tres depende del resultado de las otras: van en paralelo.
  // La FK explícita en el embed es a propósito: idea_attachments abre otro
  // camino entre project_ideas y profiles, y sin nombrarla PostgREST puede
  // responder 300 (PGRST201, embed ambiguo) y fallar en silencio.
  const [{ data: profile }, { data: idea }, { data: comments }] = await Promise.all([
    supabase.from('profiles').select('*').eq('id', user.id).single<Profile>(),
    supabase.from('project_ideas').select('*, clients(name)').eq('id', ideaId).single<ProjectIdea>(),
    supabase
      .from('project_idea_comments')
      .select('*, author:profiles!project_idea_comments_author_id_fkey(full_name)')
      .eq('idea_id', ideaId)
      .order('created_at', { ascending: true })
      .returns<ProjectIdeaComment[]>(),
  ]);

  if (!profile) redirect('/login');
  if (!idea) redirect('/ideas');

  const isAdmin = profile.role === 'admin';
  const addComment = addIdeaComment.bind(null, ideaId);

  return (
    <>
      <AppHeader isAdmin={isAdmin} isOwner={profile.is_owner} />
      <div className="flex-1 max-w-2xl mx-auto w-full px-4 py-8">
        <Link href="/ideas" className="text-sm text-tinta-suave hover:text-tinta">
          ← Ideas de proyecto
        </Link>

        <Seccion className="mt-4">
          <div className="flex items-start justify-between gap-3 mb-2">
            <h1 className="text-lg font-semibold">{idea.title}</h1>
            <Etiqueta tono={STATUS_TONO[idea.status]}>{STATUS_LABEL[idea.status]}</Etiqueta>
          </div>

          {isAdmin && idea.clients?.name && (
            <div className="text-xs text-tinta-suave mb-3">{idea.clients.name}</div>
          )}

          <p className="text-sm whitespace-pre-wrap mb-4">
            {idea.description || (
              <span className="text-tinta-suave">Sin descripción.</span>
            )}
          </p>

          {isAdmin && idea.status !== 'convertida' && (
            <div className="flex flex-wrap gap-2 mb-4 border-t border-borde pt-4">
              {idea.status === 'nueva' && (
                <form action={setIdeaStatus.bind(null, idea.id, 'en_conversacion')}>
                  <Boton type="submit" variante="secundario" className="text-sm px-3 py-1.5">
                    Marcar en conversación
                  </Boton>
                </form>
              )}
              <form action={setIdeaStatus.bind(null, idea.id, 'descartada')}>
                <Boton type="submit" variante="secundario" className="text-sm px-3 py-1.5">
                  Descartar
                </Boton>
              </form>
              <form
                action={convertIdeaToProject.bind(null, idea.id, idea.client_id)}
                className="flex gap-2 items-center flex-wrap"
              >
                <input
                  type="text"
                  name="name"
                  defaultValue={idea.title}
                  className={`${claseInput} w-auto min-w-[12rem] py-1.5`}
                />
                <Boton
                  type="submit"
                  className="bg-verde-oscuro hover:bg-exito text-sm px-3 py-1.5"
                >
                  Convertir en proyecto
                </Boton>
              </form>
            </div>
          )}

          <IdeaAttachments
            ideaId={idea.id}
            currentUserId={user.id}
            isAdmin={isAdmin}
            canUpload={isAdmin || idea.status !== 'convertida'}
          />

          <div className="border-t border-borde pt-4 space-y-3">
            {comments?.map((c) => (
              <div key={c.id} className="text-sm">
                <div className="text-[11px] text-tinta-suave">
                  {c.author?.full_name || 'Sin nombre'}
                </div>
                <div className="whitespace-pre-wrap">{c.body}</div>
              </div>
            ))}
            {(!comments || comments.length === 0) && (
              <div className="text-sm text-tinta-suave">Sin comentarios todavía.</div>
            )}
          </div>

          <form action={addComment} className="flex gap-2 mt-4 items-end">
            <textarea
              name="body"
              required
              placeholder="Escribe un comentario..."
              className={`${claseInput} flex-1 min-h-[42px]`}
            />
            <Boton type="submit" className="shrink-0">
              Enviar
            </Boton>
          </form>
        </Seccion>
      </div>
    </>
  );
}
