import { redirect } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import type { Profile, Project } from '@/lib/types';
import AppHeader from '@/components/AppHeader';
import BoardClient from '@/components/BoardClient';
import Etiqueta from '@/components/Etiqueta';

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
    // Esta pantalla tenía su propia cabecera, escrita a mano y en claro, con
    // enlaces distintos a los del resto: se quedó fuera cuando se hizo la
    // barra común. Ahora usa AppHeader como todas, y lo propio del tablero
    // —proyecto, cliente, contrato asociado— va en una segunda línea.
    <div className="flex flex-1 flex-col h-screen">
      <AppHeader isAdmin={isAdmin} isOwner={profile.is_owner} />

      <div className="bg-tarjeta border-b border-borde px-4 sm:px-5 py-2.5 flex items-center gap-3">
        <div className="flex-1 min-w-0">
          <div className="font-semibold text-sm flex items-center gap-2 flex-wrap">
            <span className="truncate">{project.name}</span>
            {project.status === 'terminado' && <Etiqueta>Terminado</Etiqueta>}
          </div>
          <div className="text-xs text-tinta-suave truncate">{project.clients?.name}</div>
        </div>

        {linkedContract && (
          <Link
            href={`/contratos/${linkedContract.id}`}
            className="text-sm text-azul hover:underline underline-offset-2 shrink-0"
            title={linkedContract.title}
          >
            Ver contrato
          </Link>
        )}
      </div>

      <BoardClient
        projectId={project.id}
        currentUserId={user.id}
        currentUserName={profile.full_name || profile.email || 'Sin nombre'}
        isAdmin={isAdmin}
      />
    </div>
  );
}
