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
  borrador: 'bg-lienzo text-tinta',
  en_revision: 'bg-aviso-fondo text-aviso',
  aprobado: 'bg-azul/10 text-azul',
  firmado_jercol: 'bg-verde/12 text-verde-oscuro',
  vigente: 'bg-exito-fondo text-exito',
  anulado: 'bg-alerta-fondo text-alerta',
};

export default async function ContractsPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  // Todo en un solo nivel. Las listas de clientes y proyectos solo se usan en
  // el formulario de admin; para un cliente, RLS las devuelve filtradas a lo
  // suyo y simplemente no se pintan.
  const [{ data: profile }, { data: contracts }, { data: cs }, { data: ps }] = await Promise.all([
    supabase.from('profiles').select('*').eq('id', user.id).single<Profile>(),
    supabase
      .from('contracts')
      .select('*, clients(name)')
      .order('created_at', { ascending: false })
      .returns<Contract[]>(),
    supabase.from('clients').select('*').eq('archived', false).order('name').returns<ClientRow[]>(),
    supabase.from('projects').select('*').order('created_at').returns<Project[]>(),
  ]);

  if (!profile) redirect('/login');

  const isAdmin = profile.role === 'admin';
  const clients: ClientRow[] = isAdmin ? cs || [] : [];
  const projects: Project[] = isAdmin ? ps || [] : [];

  return (
    <>
      <AppHeader isAdmin={isAdmin} isOwner={profile.is_owner} />
      <div className="flex-1 max-w-3xl mx-auto w-full px-4 py-8">
        <h1 className="text-xl font-semibold mb-6">Contratos</h1>

      {isAdmin && (
        <details className="bg-tarjeta border border-borde rounded-xl p-4 mb-8">
          <summary className="text-sm font-semibold text-tinta-suave uppercase tracking-wide cursor-pointer">
            Nuevo contrato
          </summary>
          <form action={createContract} className="space-y-3 mt-4">
            <div>
              <label className="block text-xs font-semibold text-tinta-suave mb-1">Título</label>
              <input
                type="text"
                name="title"
                required
                placeholder="Ej: Contrato desarrollo plataforma ADI"
                className="w-full rounded border border-borde px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-tinta-suave mb-1">Cliente</label>
              <select
                name="client_id"
                required
                className="w-full rounded border border-borde px-2 py-2 text-sm"
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
              <label className="block text-xs font-semibold text-tinta-suave mb-1">
                Proyectos que cubre (puedes marcar varios)
              </label>
              <div className="max-h-40 overflow-y-auto border border-borde rounded p-2 space-y-1">
                {projects.map((p) => (
                  <label key={p.id} className="flex items-center gap-2 text-sm">
                    <input type="checkbox" name="project_ids" value={p.id} />
                    {p.name}
                    <span className="text-xs text-tinta-suave/80">
                      {clients.find((c) => c.id === p.client_id)?.name}
                    </span>
                  </label>
                ))}
                {projects.length === 0 && (
                  <div className="text-sm text-tinta-suave/80">No hay proyectos todavía.</div>
                )}
              </div>
              <div className="text-[11px] text-tinta-suave/80 mt-1">
                Puedes dejarlo vacío ahora y asociarlo después.
              </div>
            </div>
            <button
              type="submit"
              className="rounded bg-azul text-white text-sm font-medium px-4 py-2 hover:bg-azul-oscuro cursor-pointer"
            >
              Crear contrato
            </button>
          </form>
        </details>
      )}

      <div className="space-y-2">
        {(!contracts || contracts.length === 0) && (
          <p className="text-sm text-tinta-suave">
            {isAdmin ? 'Todavía no has creado contratos.' : 'No hay contratos disponibles.'}
          </p>
        )}
        {contracts?.map((c) => (
          <Link
            key={c.id}
            href={`/contratos/${c.id}`}
            className="block bg-tarjeta border border-borde rounded-lg px-4 py-3 hover:border-azul"
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
              <div className="text-xs text-tinta-suave mt-1">{c.clients.name}</div>
            )}
          </Link>
        ))}
        </div>
      </div>
    </>
  );
}
