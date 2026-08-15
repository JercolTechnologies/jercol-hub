import Link from 'next/link';
import { redirect } from 'next/navigation';
import AppHeader from '@/components/AppHeader';
import { createClient } from '@/lib/supabase/server';
import {
  CONTRACT_STATUS_LABEL,
  type ClientRow,
  type Contract,
  type ContractStatus,
  type Profile,
  type Project,
} from '@/lib/types';
import { createContract } from './actions';

export const dynamic = 'force-dynamic';

const STATUS_COLOR: Record<ContractStatus, string> = {
  borrador: 'bg-slate-100 text-slate-600',
  en_revision: 'bg-amber-50 text-amber-700',
  aprobado: 'bg-blue-50 text-blue-700',
  firmado_jercol: 'bg-indigo-50 text-indigo-700',
  vigente: 'bg-emerald-50 text-emerald-700',
  anulado: 'bg-red-50 text-red-600',
};

export default async function ContractsPage() {
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

  const { data: contracts } = await supabase
    .from('contracts')
    .select('*, clients(name)')
    .order('created_at', { ascending: false })
    .returns<Contract[]>();

  let clients: ClientRow[] = [];
  let projects: Project[] = [];
  if (isAdmin) {
    const [{ data: cs }, { data: ps }] = await Promise.all([
      supabase.from('clients').select('*').eq('archived', false).order('name').returns<ClientRow[]>(),
      supabase.from('projects').select('*').order('created_at').returns<Project[]>(),
    ]);
    clients = cs || [];
    projects = ps || [];
  }

  return (
    <>
      <AppHeader isAdmin={isAdmin} />
      <div className="flex-1 max-w-3xl mx-auto w-full px-4 py-8">
        <h1 className="text-xl font-semibold mb-6">Contratos</h1>

      {isAdmin && (
        <details className="bg-white border border-slate-200 rounded-lg p-4 mb-8">
          <summary className="text-sm font-semibold text-slate-500 uppercase tracking-wide cursor-pointer">
            Nuevo contrato
          </summary>
          <form action={createContract} className="space-y-3 mt-4">
            <div>
              <label className="block text-xs font-semibold text-slate-500 mb-1">Título</label>
              <input
                type="text"
                name="title"
                required
                placeholder="Ej: Contrato desarrollo plataforma ADI"
                className="w-full rounded border border-slate-300 px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-500 mb-1">Cliente</label>
              <select
                name="client_id"
                required
                className="w-full rounded border border-slate-300 px-2 py-2 text-sm"
              >
                <option value="">Selecciona...</option>
                {clients.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-500 mb-1">
                Proyectos que cubre (puedes marcar varios)
              </label>
              <div className="max-h-40 overflow-y-auto border border-slate-200 rounded p-2 space-y-1">
                {projects.map((p) => (
                  <label key={p.id} className="flex items-center gap-2 text-sm">
                    <input type="checkbox" name="project_ids" value={p.id} />
                    {p.name}
                    <span className="text-xs text-slate-400">
                      {clients.find((c) => c.id === p.client_id)?.name}
                    </span>
                  </label>
                ))}
                {projects.length === 0 && (
                  <div className="text-sm text-slate-400">No hay proyectos todavía.</div>
                )}
              </div>
              <div className="text-[11px] text-slate-400 mt-1">
                Puedes dejarlo vacío ahora y asociarlo después.
              </div>
            </div>
            <button
              type="submit"
              className="rounded bg-blue-600 text-white text-sm font-medium px-4 py-2 hover:bg-blue-700 cursor-pointer"
            >
              Crear contrato
            </button>
          </form>
        </details>
      )}

      <div className="space-y-2">
        {(!contracts || contracts.length === 0) && (
          <p className="text-sm text-slate-500">
            {isAdmin ? 'Todavía no has creado contratos.' : 'No hay contratos disponibles.'}
          </p>
        )}
        {contracts?.map((c) => (
          <Link
            key={c.id}
            href={`/contratos/${c.id}`}
            className="block bg-white border border-slate-200 rounded-lg px-4 py-3 hover:border-blue-400"
          >
            <div className="flex items-center justify-between gap-2">
              <span className="font-medium text-sm">{c.title}</span>
              <span
                className={`text-[11px] px-1.5 py-0.5 rounded font-semibold shrink-0 ${STATUS_COLOR[c.status]}`}
              >
                {CONTRACT_STATUS_LABEL[c.status]}
              </span>
            </div>
            {isAdmin && c.clients?.name && (
              <div className="text-xs text-slate-500 mt-1">{c.clients.name}</div>
            )}
          </Link>
        ))}
        </div>
      </div>
    </>
  );
}
