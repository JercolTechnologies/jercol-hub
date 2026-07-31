import Link from 'next/link';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import type { ClientRow, Profile, Project } from '@/lib/types';
import { createClientOrg, createProject, assignUser, setClientArchived } from './actions';

type ProjectWithClient = Project & { clients: { name: string } | null };

export default async function AdminPage() {
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

  if (!profile || profile.role !== 'admin') redirect('/');

  const [{ data: clients }, { data: pending }, { data: projects }] = await Promise.all([
    supabase.from('clients').select('*').order('name').returns<ClientRow[]>(),
    supabase
      .from('profiles')
      .select('*')
      .eq('role', 'client')
      .is('client_id', null)
      .returns<Profile[]>(),
    supabase
      .from('projects')
      .select('*, clients(name)')
      .order('created_at', { ascending: true })
      .returns<ProjectWithClient[]>(),
  ]);

  const allClients = clients || [];
  const activeClients = allClients.filter((c) => !c.archived);
  const archivedClients = allClients.filter((c) => c.archived);
  const projectsByClient = new Map<string, ProjectWithClient[]>();
  (projects || []).forEach((p) => {
    const list = projectsByClient.get(p.client_id) || [];
    list.push(p);
    projectsByClient.set(p.client_id, list);
  });

  function ClientCard({ c }: { c: ClientRow }) {
    return (
      <div className="bg-white border border-slate-200 rounded-lg p-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-medium">{c.name}</h3>
          <form action={setClientArchived.bind(null, c.id, !c.archived)}>
            <button type="submit" className="text-xs text-slate-500 hover:underline">
              {c.archived ? 'Desarchivar' : 'Archivar'}
            </button>
          </form>
        </div>
        <ul className="space-y-1 mb-3">
          {(projectsByClient.get(c.id) || []).map((p) => (
            <li key={p.id}>
              <Link href={`/board/${p.id}`} className="text-sm text-blue-600 hover:underline">
                {p.name}
              </Link>
            </li>
          ))}
          {(projectsByClient.get(c.id) || []).length === 0 && (
            <li className="text-sm text-slate-400">Sin proyectos todavía.</li>
          )}
        </ul>
        {!c.archived && (
          <form action={createProject.bind(null, c.id)} className="flex gap-2">
            <input
              type="text"
              name="name"
              required
              placeholder="Nuevo proyecto"
              className="flex-1 rounded border border-slate-300 px-3 py-1.5 text-sm"
            />
            <button
              type="submit"
              className="rounded bg-slate-100 text-slate-700 text-sm px-3 py-1.5 hover:bg-slate-200"
            >
              + Proyecto
            </button>
          </form>
        )}
      </div>
    );
  }

  return (
    <div className="flex-1 max-w-5xl mx-auto w-full px-4 py-8">
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-xl font-semibold">Jercol Hub — Admin</h1>
        <div className="flex items-center gap-4">
          <Link href="/ideas" className="text-sm text-slate-500 hover:underline">
            Ideas de proyecto
          </Link>
          <form action="/logout" method="post">
            <button className="text-sm text-slate-500 hover:underline" type="submit">
              Cerrar sesión
            </button>
          </form>
        </div>
      </div>

      <section className="mb-10">
        <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wide mb-3">
          Nuevo cliente
        </h2>
        <form action={createClientOrg} className="flex gap-2 max-w-md">
          <input
            type="text"
            name="name"
            required
            placeholder="Nombre del cliente / empresa"
            className="flex-1 rounded border border-slate-300 px-3 py-2 text-sm"
          />
          <button
            type="submit"
            className="rounded bg-blue-600 text-white text-sm font-medium px-4 py-2 hover:bg-blue-700"
          >
            Crear
          </button>
        </form>
      </section>

      {pending && pending.length > 0 && (
        <section className="mb-10">
          <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wide mb-3">
            Usuarios pendientes de asignar
          </h2>
          <div className="space-y-2">
            {pending.map((p) => (
              <form
                key={p.id}
                action={assignUser}
                className="flex items-center gap-2 bg-white border border-slate-200 rounded-lg px-4 py-2"
              >
                <input type="hidden" name="user_id" value={p.id} />
                <div className="flex-1 text-sm">
                  <div className="font-medium">{p.full_name || 'Sin nombre'}</div>
                  <div className="text-slate-500">{p.email}</div>
                </div>
                <select
                  name="client_id"
                  required
                  className="rounded border border-slate-300 text-sm px-2 py-1"
                >
                  <option value="">Asignar a...</option>
                  {activeClients.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
                <button
                  type="submit"
                  className="rounded bg-slate-800 text-white text-sm px-3 py-1 hover:bg-slate-700"
                >
                  Asignar
                </button>
              </form>
            ))}
          </div>
        </section>
      )}

      <section className="mb-10">
        <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wide mb-3">
          Clientes y proyectos
        </h2>
        {activeClients.length === 0 && (
          <p className="text-sm text-slate-500">Crea tu primer cliente arriba.</p>
        )}
        <div className="space-y-6">
          {activeClients.map((c) => (
            <ClientCard key={c.id} c={c} />
          ))}
        </div>
      </section>

      {archivedClients.length > 0 && (
        <details className="mb-10">
          <summary className="text-sm font-semibold text-slate-500 uppercase tracking-wide mb-3 cursor-pointer">
            Archivados ({archivedClients.length})
          </summary>
          <div className="space-y-6 mt-3">
            {archivedClients.map((c) => (
              <ClientCard key={c.id} c={c} />
            ))}
          </div>
        </details>
      )}
    </div>
  );
}
