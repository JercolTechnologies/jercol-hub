import Link from 'next/link';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import type { Profile, ProjectIdea, ProjectIdeaComment } from '@/lib/types';
import { addIdeaComment, setIdeaStatus, convertIdeaToProject } from '../actions';
import IdeaAttachments from '@/components/IdeaAttachments';

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

  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single<Profile>();
  if (!profile) redirect('/login');

  const isAdmin = profile.role === 'admin';

  const { data: idea } = await supabase
    .from('project_ideas')
    .select('*, clients(name)')
    .eq('id', ideaId)
    .single<ProjectIdea>();

  if (!idea) redirect('/ideas');

  // FK explícita a propósito: idea_attachments abre otro camino entre
  // project_ideas y profiles, y sin nombrarla PostgREST puede responder 300
  // (PGRST201, embed ambiguo) y fallar en silencio.
  const { data: comments } = await supabase
    .from('project_idea_comments')
    .select('*, author:profiles!project_idea_comments_author_id_fkey(full_name)')
    .eq('idea_id', ideaId)
    .order('created_at', { ascending: true })
    .returns<ProjectIdeaComment[]>();

  const addComment = addIdeaComment.bind(null, ideaId);

  return (
    <div className="flex-1 max-w-2xl mx-auto w-full px-4 py-8">
      <Link href="/ideas" className="text-sm text-slate-500 hover:underline">
        ← Ideas de proyecto
      </Link>

      <div className="bg-white border border-slate-200 rounded-lg p-5 mt-4">
        <div className="flex items-center justify-between gap-2 mb-2">
          <h1 className="text-lg font-semibold">{idea.title}</h1>
          <span className="text-xs text-slate-500">{idea.status}</span>
        </div>
        {isAdmin && idea.clients?.name && (
          <div className="text-xs text-slate-500 mb-3">{idea.clients.name}</div>
        )}
        <p className="text-sm whitespace-pre-wrap mb-4">{idea.description || '(sin descripción)'}</p>

        {isAdmin && idea.status !== 'convertida' && (
          <div className="flex flex-wrap gap-2 mb-4 border-t border-slate-100 pt-4">
            {idea.status === 'nueva' && (
              <form action={setIdeaStatus.bind(null, idea.id, 'en_conversacion')}>
                <button type="submit" className="text-sm px-3 py-1.5 rounded bg-amber-100 text-amber-800 hover:bg-amber-200">
                  Marcar en conversación
                </button>
              </form>
            )}
            <form action={setIdeaStatus.bind(null, idea.id, 'descartada')}>
              <button type="submit" className="text-sm px-3 py-1.5 rounded border border-slate-300 hover:bg-slate-50">
                Descartar
              </button>
            </form>
            <form
              action={convertIdeaToProject.bind(null, idea.id, idea.client_id)}
              className="flex gap-2 items-center"
            >
              <input
                type="text"
                name="name"
                defaultValue={idea.title}
                className="rounded border border-slate-300 px-2 py-1.5 text-sm"
              />
              <button
                type="submit"
                className="text-sm px-3 py-1.5 rounded bg-emerald-600 text-white hover:bg-emerald-700"
              >
                Convertir en proyecto
              </button>
            </form>
          </div>
        )}

        <IdeaAttachments
          ideaId={idea.id}
          currentUserId={user.id}
          isAdmin={isAdmin}
          canUpload={isAdmin || idea.status !== 'convertida'}
        />

        <div className="border-t border-slate-200 pt-4 space-y-3">
          {comments?.map((c) => (
            <div key={c.id} className="text-sm">
              <div className="text-[11px] text-slate-400">{c.author?.full_name || 'anon'}</div>
              <div className="whitespace-pre-wrap">{c.body}</div>
            </div>
          ))}
          {(!comments || comments.length === 0) && (
            <div className="text-sm text-slate-400">Sin comentarios todavía.</div>
          )}
        </div>

        <form action={addComment} className="flex gap-2 mt-4">
          <textarea
            name="body"
            required
            placeholder="Escribe un comentario..."
            className="flex-1 rounded border border-slate-300 px-3 py-2 text-sm min-h-[40px]"
          />
          <button
            type="submit"
            className="text-sm px-3 py-1.5 rounded bg-blue-600 text-white hover:bg-blue-700 self-end"
          >
            Enviar
          </button>
        </form>
      </div>
    </div>
  );
}
