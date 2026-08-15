import Link from 'next/link';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import ContractFileLink from '@/components/ContractFileLink';
import InfoTip from '@/components/InfoTip';
import {
  ADDENDUM_CHANNEL_LABEL,
  CONTRACT_STATUS_LABEL,
  type ClientContact,
  type Contract,
  type ContractAddendum,
  type ContractComment,
  type ContractVersion,
  type Profile,
  type Project,
} from '@/lib/types';
import {
  setContractStatus,
  setContractSigner,
  uploadVersion,
  addContractComment,
  addAddendum,
} from '../actions';

function fmtDate(iso: string) {
  try {
    return new Date(iso).toLocaleString('es', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return '';
  }
}

function formatBytes(n: number | null) {
  if (!n) return '';
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

export default async function ContractDetailPage({
  params,
}: {
  params: Promise<{ contractId: string }>;
}) {
  const { contractId } = await params;
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

  const { data: contract } = await supabase
    .from('contracts')
    .select('*, clients(name)')
    .eq('id', contractId)
    .single<Contract>();

  if (!contract) redirect('/contratos');

  const [{ data: versions }, { data: comments }, { data: addenda }, { data: contacts }, { data: links }] =
    await Promise.all([
      supabase
        .from('contract_versions')
        .select('*')
        .eq('contract_id', contractId)
        .order('version_number', { ascending: false })
        .returns<ContractVersion[]>(),
      supabase
        .from('contract_comments')
        .select('*, author:profiles!contract_comments_author_id_fkey(full_name)')
        .eq('contract_id', contractId)
        .order('created_at', { ascending: true })
        .returns<ContractComment[]>(),
      supabase
        .from('contract_addenda')
        .select('*')
        .eq('contract_id', contractId)
        .order('agreed_on', { ascending: false })
        .returns<ContractAddendum[]>(),
      supabase
        .from('client_contacts')
        .select('*')
        .eq('client_id', contract.client_id)
        .returns<ClientContact[]>(),
      supabase
        .from('contract_projects')
        .select('project_id, projects(id, name)')
        .eq('contract_id', contractId),
    ]);

  const versionList = versions || [];
  const latest = versionList[0];
  const contactList = contacts || [];
  const signer = contactList.find((c) => c.id === contract.signer_contact_id);
  const linkedProjects = (links || [])
    .map((l) => (l as unknown as { projects: Project | null }).projects)
    .filter(Boolean) as Project[];

  const addComment = addContractComment.bind(null, contractId);

  return (
    <div className="flex-1 max-w-2xl mx-auto w-full px-4 py-8">
      <Link href="/contratos" className="text-sm text-slate-500 hover:underline">
        ← Contratos
      </Link>

      <div className="bg-white border border-slate-200 rounded-lg p-5 mt-4">
        <div className="flex items-start justify-between gap-2 mb-1">
          <h1 className="text-lg font-semibold">{contract.title}</h1>
          <span className="text-xs text-slate-500 shrink-0">
            {CONTRACT_STATUS_LABEL[contract.status]}
          </span>
        </div>
        {isAdmin && contract.clients?.name && (
          <div className="text-xs text-slate-500 mb-3">{contract.clients.name}</div>
        )}

        {linkedProjects.length > 0 && (
          <div className="text-xs text-slate-500 mb-4">
            Cubre:{' '}
            {linkedProjects.map((p, i) => (
              <span key={p.id}>
                {i > 0 && ', '}
                <Link href={`/board/${p.id}`} className="text-blue-600 hover:underline">
                  {p.name}
                </Link>
              </span>
            ))}
          </div>
        )}

        {/* ---------- Firmante autorizado ---------- */}
        <div className="border-t border-slate-100 pt-4 mb-4">
          <label className="text-xs font-semibold text-slate-500 flex items-center gap-1.5 mb-2">
            Firmante autorizado
            <InfoTip text="Debe ser el representante legal, salvo que exista un poder que autorice a otra persona." />
          </label>
          {isAdmin ? (
            <form action={setContractSigner.bind(null, contractId)} className="flex gap-2">
              <select
                name="signer_contact_id"
                defaultValue={contract.signer_contact_id || ''}
                className="flex-1 rounded border border-slate-300 px-2 py-1.5 text-sm"
              >
                <option value="">Sin definir</option>
                {contactList.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.full_name}
                    {c.is_legal_rep ? ' (Rep. legal)' : ''}
                  </option>
                ))}
              </select>
              <button
                type="submit"
                className="text-sm px-3 py-1.5 rounded bg-slate-100 hover:bg-slate-200"
              >
                Guardar
              </button>
            </form>
          ) : (
            <div className="text-sm">{signer?.full_name || 'Sin definir'}</div>
          )}
          {isAdmin && contactList.length === 0 && (
            <div className="text-[11px] text-amber-600 mt-1">
              Este cliente no tiene contactos registrados. Agrégalos desde el panel de admin.
            </div>
          )}
        </div>

        {/* ---------- Versiones ---------- */}
        <div className="border-t border-slate-100 pt-4 mb-4">
          <div className="flex items-center justify-between mb-2">
            <label className="text-xs font-semibold text-slate-500">Documento</label>
            {latest && <span className="text-[11px] text-slate-400">v{latest.version_number}</span>}
          </div>

          {versionList.length === 0 && (
            <div className="text-sm text-slate-400 mb-2">Sin documento todavía.</div>
          )}

          {versionList.map((v, i) => (
            <div key={v.id} className="flex items-center gap-2 text-sm mb-1">
              <ContractFileLink path={v.storage_path} label={`v${v.version_number} · ${v.file_name}`} />
              <span className="text-[11px] text-slate-400">{formatBytes(v.size_bytes)}</span>
              {i === 0 && (
                <span className="text-[11px] px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700 font-semibold">
                  actual
                </span>
              )}
              {v.notes && <span className="text-[11px] text-slate-400">— {v.notes}</span>}
            </div>
          ))}

          {isAdmin && (
            <form action={uploadVersion.bind(null, contractId)} className="mt-3 space-y-2">
              <input
                type="file"
                name="file"
                accept="application/pdf"
                required
                className="block text-sm"
              />
              <div className="flex gap-2">
                <input
                  type="text"
                  name="notes"
                  placeholder="Nota de la versión (opcional)"
                  className="flex-1 rounded border border-slate-300 px-2 py-1.5 text-sm"
                />
                <button
                  type="submit"
                  className="text-sm px-3 py-1.5 rounded bg-slate-100 hover:bg-slate-200"
                >
                  Subir versión
                </button>
              </div>
            </form>
          )}
        </div>

        {/* ---------- Acciones de estado ---------- */}
        <div className="border-t border-slate-100 pt-4 mb-4 flex flex-wrap gap-2">
          {isAdmin && contract.status === 'borrador' && latest && (
            <form action={setContractStatus.bind(null, contractId, 'en_revision')}>
              <button className="text-sm px-3 py-1.5 rounded bg-blue-600 text-white hover:bg-blue-700">
                Publicar para revisión del cliente
              </button>
            </form>
          )}
          {isAdmin && contract.status === 'borrador' && !latest && (
            <span className="text-xs text-slate-400">Sube el documento para poder publicarlo.</span>
          )}
          {!isAdmin && contract.status === 'en_revision' && (
            <form action={setContractStatus.bind(null, contractId, 'aprobado')}>
              <button className="text-sm px-3 py-1.5 rounded bg-emerald-600 text-white hover:bg-emerald-700">
                ✓ Dar visto bueno
              </button>
            </form>
          )}
          {isAdmin && contract.status === 'aprobado' && (
            <span className="text-xs text-slate-500">
              El cliente ya dio el visto bueno. La firma llega en la siguiente entrega.
            </span>
          )}
          {isAdmin && contract.status !== 'anulado' && contract.status !== 'borrador' && (
            <form action={setContractStatus.bind(null, contractId, 'anulado')}>
              <button className="text-sm px-3 py-1.5 rounded border border-slate-300 hover:bg-slate-50">
                Anular
              </button>
            </form>
          )}
        </div>

        {/* ---------- Otrosíes / adendas ---------- */}
        <div className="border-t border-slate-100 pt-4 mb-4">
          <label className="text-xs font-semibold text-slate-500 flex items-center gap-1.5 mb-2">
            Otrosíes y acuerdos
            <InfoTip text="Acuerdos hechos por WhatsApp o correo que modifican o amplían el contrato. Se registran aquí con su evidencia para que queden a la mano." />
          </label>

          {(!addenda || addenda.length === 0) && (
            <div className="text-sm text-slate-400 mb-2">Sin acuerdos registrados.</div>
          )}

          <ul className="space-y-3 mb-3">
            {addenda?.map((a) => (
              <li key={a.id} className="text-sm border-l-2 border-slate-200 pl-3">
                <div className="text-[11px] text-slate-400">
                  {a.agreed_on} · {ADDENDUM_CHANNEL_LABEL[a.channel]}
                  {a.counterpart ? ` · con ${a.counterpart}` : ''}
                </div>
                <div className="whitespace-pre-wrap">{a.body}</div>
                {a.evidence_path && (
                  <ContractFileLink
                    path={a.evidence_path}
                    label="Ver evidencia"
                    className="text-xs text-blue-600 hover:underline"
                  />
                )}
              </li>
            ))}
          </ul>

          {isAdmin && (
            <details>
              <summary className="text-xs text-blue-600 cursor-pointer">+ Registrar acuerdo</summary>
              <form action={addAddendum.bind(null, contractId)} className="space-y-2 mt-2">
                <div className="flex gap-2">
                  <input
                    type="date"
                    name="agreed_on"
                    required
                    className="rounded border border-slate-300 px-2 py-1.5 text-sm"
                  />
                  <select
                    name="channel"
                    className="rounded border border-slate-300 px-2 py-1.5 text-sm"
                  >
                    <option value="whatsapp">WhatsApp</option>
                    <option value="correo">Correo</option>
                    <option value="llamada">Llamada</option>
                    <option value="otro">Otro</option>
                  </select>
                  <input
                    type="text"
                    name="counterpart"
                    placeholder="Con quién"
                    className="flex-1 rounded border border-slate-300 px-2 py-1.5 text-sm"
                  />
                </div>
                <textarea
                  name="body"
                  required
                  placeholder="Qué se acordó exactamente..."
                  className="w-full rounded border border-slate-300 px-3 py-2 text-sm min-h-[70px]"
                />
                <div className="flex gap-2 items-center">
                  <input type="file" name="evidence" className="text-sm flex-1" />
                  <button
                    type="submit"
                    className="text-sm px-3 py-1.5 rounded bg-slate-100 hover:bg-slate-200"
                  >
                    Guardar acuerdo
                  </button>
                </div>
              </form>
            </details>
          )}
        </div>

        {/* ---------- Comentarios ---------- */}
        <div className="border-t border-slate-100 pt-4 space-y-3">
          <label className="text-xs font-semibold text-slate-500">Conversación</label>
          {comments?.map((c) => (
            <div key={c.id} className="text-sm">
              <div className="text-[11px] text-slate-400">
                {c.author?.full_name || 'anon'} · {fmtDate(c.created_at)}
              </div>
              <div className="whitespace-pre-wrap">{c.body}</div>
            </div>
          ))}
          {(!comments || comments.length === 0) && (
            <div className="text-sm text-slate-400">Sin comentarios todavía.</div>
          )}
        </div>

        {contract.status !== 'borrador' && (
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
        )}
      </div>
    </div>
  );
}
