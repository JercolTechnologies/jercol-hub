import Link from 'next/link';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import type { Profile, ProjectIdea, IdeaStatus } from '@/lib/types';
import { createIdea } from './actions';

const STATUS_LABEL: Record<IdeaStatus, string> = {
  nueva: 'Nueva',
  en_conversacion: 'En conversación',
  convertida: 'Convertida en proyecto',
  descartada: 'Descartada',
};
const STATUS_COLOR: Record<IdeaStatus, string> = {
  nueva: 'bg-blue-50 text-blue-700',
  en_conversacion: 'bg-amber-50 text-amber-700',
  convertida: 'bg-emerald-50 text-emerald-700',
  descartada: 'bg-slate-100 text-slate-500',
};

export default async function IdeasPage() {
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

  const { data: ideas } = await supabase
    .from('project_ideas')
    .select('*, clients(name)')
    .order('created_at', { ascending: false })
    .returns<ProjectIdea[]>();

  return (
    <div className="flex-1 max-w-3xl mx-auto w-full px-4 py-8">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-semibold">Ideas de proyecto</h1>
        <Link href={isAdmin ? '/admin' : '/'} className="text-sm text-slate-500 hover:underline">
          ← Volver
        </Link>
      </div>

      <p className="text-sm text-slate-500 mb-6">
        Espacio separado del tablero de tareas — para proponer y conversar sobre proyectos nuevos
        antes de que se formalicen.
      </p>

      {!isAdmin && profile.client_id && (
        <form action={createIdea} className="bg-white border border-slate-200 rounded-lg p-4 mb-8 space-y-3">
          <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wide">Nueva idea</h2>
          <input
            type="text"
            name="title"
            required
            placeholder="Título de la idea"
            className="w-full rounded border border-slate-300 px-3 py-2 text-sm"
          />
          <textarea
            name="description"
            placeholder="Cuéntanos de qué se trata..."
            className="w-full rounded border border-slate-300 px-3 py-2 text-sm min-h-[70px]"
          />
          <button
            type="submit"
            className="rounded bg-blue-600 text-white text-sm font-medium px-4 py-2 hover:bg-blue-700"
          >
            Enviar idea
          </button>
        </form>
      )}

      <div className="space-y-2">
        {(!ideas || ideas.length === 0) && (
          <p className="text-sm text-slate-500">Todavía no hay ideas registradas.</p>
        )}
        {ideas?.map((idea) => (
          <Link
            key={idea.id}
            href={`/ideas/${idea.id}`}
            className="block bg-white border border-slate-200 rounded-lg px-4 py-3 hover:border-blue-400"
          >
            <div className="flex items-center justify-between gap-2">
              <span className="font-medium text-sm">{idea.title}</span>
              <span className={`text-[11px] px-1.5 py-0.5 rounded font-semibold shrink-0 ${STATUS_COLOR[idea.status]}`}>
                {STATUS_LABEL[idea.status]}
              </span>
            </div>
            {isAdmin && idea.clients?.name && (
              <div className="text-xs text-slate-500 mt-1">{idea.clients.name}</div>
            )}
          </Link>
        ))}
      </div>
    </div>
  );
}
