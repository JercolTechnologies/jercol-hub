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

  // Las tres consultas son independientes entre sí. RLS decide qué devuelve
  // cada una: si el usuario no puede ver el proyecto, llega null; y del
  // contrato asociado, el cliente nunca recibe borradores.
  const [{ data: profile }, { data: project }, { data: contractLink }] = await Promise.all([
    supabase.from('profiles').select('*').eq('id', user.id).single<Profile>(),
    supabase
      .from('projects')
      .select('*, clients(name)')
      .eq('id', projectId)
      .single<ProjectWithClient>(),
    supabase
      .from('contract_projects')
      .select('contract_id, contracts(id, title, status)')
      .eq('project_id', projectId)
      .limit(1)
      .maybeSingle(),
  ]);

  if (!profile) redirect('/login');
  if (!project) redirect('/');

  const isAdmin = profile.role === 'admin';

  const linkedContract = (contractLink as unknown as {
    contracts: { id: string; title: string; status: string } | null;
  } | null)?.contracts;

  return (
    <div className="flex flex-1 flex-col h-screen">
      <header className="bg-white border-b border-slate-200 px-5 py-3 flex items-center gap-3">
        <Link
          href={isAdmin ? '/admin' : '/'}
          className="text-sm text-slate-500 hover:text-slate-800 shrink-0"
        >
          ← {isAdmin ? 'Panel' : 'Mis proyectos'}
        </Link>
        <div className="flex-1">
          <div className="font-semibold text-sm">
            {project.name}
            {project.status === 'terminado' && (
              <span className="ml-2 text-[11px] px-1.5 py-0.5 rounded bg-slate-100 text-slate-500 font-normal">
                Terminado
              </span>
            )}
          </div>
          <div className="text-xs text-slate-500">{project.clients?.name}</div>
        </div>
        {linkedContract && (
          <Link
            href={`/contratos/${linkedContract.id}`}
            className="text-sm text-slate-500 hover:text-slate-800"
            title={linkedContract.title}
          >
            📄 Contrato
          </Link>
        )}
        <Link href="/contratos" className="text-sm text-slate-500 hover:text-slate-800">
          Contratos
        </Link>
        <Link href="/ideas" className="text-sm text-slate-500 hover:text-slate-800">
          Ideas
        </Link>
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
        isAdmin={isAdmin}
      />
    </div>
  );
}
