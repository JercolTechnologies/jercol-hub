import { redirect } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import type { Profile, Project } from '@/lib/types';
import BoardClient from '@/components/BoardClient';

type ProjectWithClient = Project & { clients: { name: string } | null };

export default async function BoardPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;
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

  // RLS decide si este usuario puede ver el proyecto. Si no puede, data viene null.
  const { data: project } = await supabase
    .from('projects')
    .select('*, clients(name)')
    .eq('id', projectId)
    .single<ProjectWithClient>();

  if (!project) redirect('/');

  const isAdmin = profile.role === 'admin';

  return (
    <div className="flex flex-1 flex-col h-screen">
      <header className="bg-white border-b border-slate-200 px-5 py-3 flex items-center gap-3">
        <Link
          href={isAdmin ? '/admin' : '/'}
          className="text-sm text-slate-500 hover:text-slate-800"
        >
          ← Volver
        </Link>
        <div className="flex-1">
          <div className="font-semibold text-sm">{project.name}</div>
          <div className="text-xs text-slate-500">{project.clients?.name}</div>
        </div>
        <form action="/logout" method="post">
          <button className="text-sm text-slate-500 hover:underline" type="submit">
            Cerrar sesión
          </button>
        </form>
      </header>
      <BoardClient
        projectId={project.id}
        currentUserId={user.id}
        currentUserName={profile.full_name || profile.email || 'Sin nombre'}
      />
    </div>
  );
}
