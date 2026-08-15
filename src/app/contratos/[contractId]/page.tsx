import Link from 'next/link';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import AppHeader from '@/components/AppHeader';
import ContractFileLink from '@/components/ContractFileLink';
import FileField from '@/components/FileField';
import FileUploadForm from '@/components/FileUploadForm';
import InfoTip from '@/components/InfoTip';
import RealtimeRefresh from '@/components/RealtimeRefresh';
import SignContractForm from '@/components/SignContractForm';
import {
  ADDENDUM_CHANNEL_LABEL,
  CONTRACT_STATUS_LABEL,
  type ClientContact,
  type Contract,
  type ContractAddendum,
  type ContractComment,
  type ContractSignature,
  type ContractStatus,
  type ContractVersion,
  type Profile,
  type Project,
} from '@/lib/types';
import {
  setContractStatus,
  setContractSigner,
  uploadVersion,
  uploadPoder,
  updateContractProjects,
  deleteContract,
  addContractComment,
  addAddendum,
  signContract,
} from '../actions';

const DISCLAIMER_JERCOL =
  'Declaro que soy quien dice ser y que firmo este contrato en nombre de Jercol Technologies.';

const DISCLAIMER_CLIENTE =
  'Declaro que soy el representante legal (o su apoderado debidamente facultado) y que estoy autorizado para firmar este contrato. Entiendo que Jercol Technologies no responde por firmas realizadas por terceros no autorizados desde esta cuenta.';

// Sin caché: el estado del contrato cambia desde dos cuentas distintas y
// tiene que verse al instante en ambas.
export const dynamic = 'force-dynamic';

const STATUS_COLOR: Record<ContractStatus, string> = {
  borrador: 'bg-slate-100 text-slate-600',
  en_revision: 'bg-amber-50 text-amber-700',
  aprobado: 'bg-blue-50 text-blue-700',
  firmado_jercol: 'bg-indigo-50 text-indigo-700',
  vigente: 'bg-emerald-50 text-emerald-700',
  anulado: 'bg-red-50 text-red-600',
};

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

  const { data: signatures } = await supabase
    .from('contract_signatures')
    .select('*')
    .eq('contract_id', contractId)
    .returns<ContractSignature[]>();

  // Para poder reasignar qué proyectos cubre el contrato (solo admin).
  const { data: clientProjects } = isAdmin
    ? await supabase
        .from('projects')
        .select('*')
        .eq('client_id', contract.client_id)
        .order('created_at')
        .returns<Project[]>()
    : { data: [] as Project[] };

  const versionList = versions || [];
  const latest = versionList[0];
  const contactList = contacts || [];
  const signer = contactList.find((c) => c.id === contract.signer_contact_id);
  const linkedProjects = (links || [])
    .map((l) => (l as unknown as { projects: Project | null }).projects)
    .filter(Boolean) as Project[];

  const addComment = addContractComment.bind(null, contractId);

  const sigList = signatures || [];
  const signedByJercol = sigList.some((s) => s.signer_role === 'jercol');
  // Solo la cuenta vinculada al contacto designado puede firmar por el cliente.
  const canClientSign =
    !isAdmin &&
    contract.status === 'firmado_jercol' &&
    !!signer?.profile_id &&
    signer.profile_id === user.id;

  return (
    <>
      <AppHeader isAdmin={isAdmin} />
      <div className="flex-1 max-w-2xl mx-auto w-full px-4 py-8">
        <Link href="/contratos" className="text-sm text-slate-500 hover:underline">
          ← Contratos
        </Link>

      <RealtimeRefresh
        channel={`contract-${contractId}`}
        tables={[
          'contracts',
          'contract_versions',
          'contract_comments',
          'contract_addenda',
          'contract_signatures',
        ]}
      />

      <div className="bg-white border border-slate-200 rounded-lg p-5 mt-4">
        <div className="flex items-start justify-between gap-2 mb-1">
          <h1 className="text-lg font-semibold">{contract.title}</h1>
          <span
            className={`text-[11px] px-2 py-0.5 rounded font-semibold shrink-0 ${STATUS_COLOR[contract.status]}`}
          >
            {CONTRACT_STATUS_LABEL[contract.status]}
          </span>
        </div>
        {isAdmin && contract.clients?.name && (
          <div className="text-xs text-slate-500 mb-3">{contract.clients.name}</div>
        )}

        {contract.status === 'aprobado' && (
          <div className="text-xs bg-blue-50 text-blue-700 rounded px-3 py-2 mb-3">
            {isAdmin
              ? 'El cliente dio el visto bueno. Falta la firma de ambas partes.'
              : 'Diste el visto bueno a este contrato. Queda pendiente la firma.'}
          </div>
        )}

        {linkedProjects.length > 0 && (
          <div className="text-xs text-slate-500 mb-2">
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

        {isAdmin && (
          <details className="mb-4">
            <summary className="text-xs text-blue-600 cursor-pointer">
              Cambiar proyectos que cubre
            </summary>
            <form action={updateContractProjects.bind(null, contractId)} className="mt-2">
              <div className="max-h-40 overflow-y-auto border border-slate-200 rounded p-2 space-y-1 mb-2">
                {(clientProjects || []).map((p) => (
                  <label key={p.id} className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      name="project_ids"
                      value={p.id}
                      defaultChecked={linkedProjects.some((lp) => lp.id === p.id)}
                    />
                    {p.name}
                  </label>
                ))}
                {(clientProjects || []).length === 0 && (
                  <div className="text-sm text-slate-400">
                    Este cliente no tiene proyectos todavía.
                  </div>
                )}
              </div>
              <button
                type="submit"
                className="text-sm px-3 py-1.5 rounded bg-slate-100 hover:bg-slate-200 cursor-pointer"
              >
                Guardar proyectos
              </button>
            </form>
          </details>
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
                className="text-sm px-3 py-1.5 rounded bg-slate-100 hover:bg-slate-200 cursor-pointer"
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

          {signer && !signer.is_legal_rep && (
            <div className="text-[11px] text-amber-600 mt-1">
              Este firmante no está marcado como representante legal: adjunta el poder que lo
              autoriza.
            </div>
          )}

          <div className="mt-3">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-xs font-semibold text-slate-500">Poder</span>
              <InfoTip text="Documento que autoriza a firmar a alguien distinto del representante legal. Opcional si firma el RL." />
              {contract.poder_path && (
                <ContractFileLink
                  path={contract.poder_path}
                  label="Ver poder"
                  className="text-xs text-blue-600 hover:underline cursor-pointer"
                />
              )}
              {!contract.poder_path && (
                <span className="text-xs text-slate-400">Sin adjuntar</span>
              )}
            </div>
            {isAdmin && (
              <FileUploadForm
                action={uploadPoder.bind(null, contractId)}
                fileLabel="Elegir poder"
                submitLabel={contract.poder_path ? 'Reemplazar' : 'Subir poder'}
              />
            )}
          </div>
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

          {isAdmin && contract.status !== 'vigente' && (
            <div className="mt-3">
              <FileUploadForm
                action={uploadVersion.bind(null, contractId)}
                accept="application/pdf"
                fileLabel="Elegir PDF"
                submitLabel="Subir versión"
                withNotes
                notesPlaceholder="Nota de la versión (opcional)"
              />
            </div>
          )}
          {isAdmin && contract.status === 'vigente' && (
            <div className="text-[11px] text-slate-400 mt-2">
              El contrato está firmado: ya no se pueden subir versiones nuevas.
            </div>
          )}
        </div>

        {/* ---------- Firmas ---------- */}
        {(contract.status === 'aprobado' ||
          contract.status === 'firmado_jercol' ||
          contract.status === 'vigente') && (
          <div className="border-t border-slate-100 pt-4 mb-4">
            <label className="text-xs font-semibold text-slate-500 flex items-center gap-1.5 mb-2">
              Firmas
              <InfoTip text="Firma primero Jercol y después el firmante autorizado del cliente. Al completarse ambas, se genera el PDF final con el certificado de firma." />
            </label>

            {sigList.length === 0 && (
              <div className="text-sm text-slate-400 mb-2">Sin firmas todavía.</div>
            )}

            <ul className="space-y-2 mb-3">
              {sigList
                .slice()
                .sort((a, b) => (a.signer_role === 'jercol' ? -1 : 1))
                .map((s) => (
                  <li key={s.id} className="text-sm border-l-2 border-emerald-200 pl-3">
                    <div className="font-medium">
                      {s.signer_role === 'jercol' ? 'Jercol Technologies' : 'Cliente'} ·{' '}
                      {s.full_name}
                    </div>
                    <div className="text-[11px] text-slate-400">
                      Doc. {s.document_id} · {fmtDate(s.signed_at)}
                      {s.ip ? ` · IP ${s.ip}` : ''}
                    </div>
                  </li>
                ))}
            </ul>

            {contract.status === 'vigente' && contract.signed_path && (
              <div className="bg-emerald-50 rounded px-3 py-2">
                <ContractFileLink
                  path={contract.signed_path}
                  label="Descargar contrato firmado (con certificado)"
                  className="text-sm text-emerald-700 font-medium hover:underline cursor-pointer"
                />
              </div>
            )}

            {isAdmin && contract.status === 'aprobado' && !signedByJercol && (
              <SignContractForm
                action={signContract.bind(null, contractId)}
                heading="Firmar como Jercol Technologies"
                disclaimer={DISCLAIMER_JERCOL}
              />
            )}

            {canClientSign && (
              <SignContractForm
                action={signContract.bind(null, contractId)}
                defaultName={signer?.full_name || profile.full_name || ''}
                heading="Firmar contrato"
                disclaimer={DISCLAIMER_CLIENTE}
              />
            )}

            {!isAdmin && contract.status === 'firmado_jercol' && !canClientSign && (
              <div className="text-xs bg-amber-50 text-amber-800 rounded px-3 py-2">
                Este contrato debe firmarlo el representante legal designado. Si eres tú, pide que
                vinculen tu cuenta al contacto correspondiente.
              </div>
            )}

            {isAdmin && contract.status === 'firmado_jercol' && (
              <div className="text-xs text-slate-500">
                Ya firmaste. Falta la firma del cliente.
                {!signer?.profile_id && (
                  <span className="text-amber-600">
                    {' '}
                    El firmante designado no tiene cuenta vinculada, así que todavía no puede
                    firmar.
                  </span>
                )}
              </div>
            )}
          </div>
        )}

        {/* ---------- Acciones de estado ---------- */}
        <div className="border-t border-slate-100 pt-4 mb-4 flex flex-wrap gap-2 items-center">
          {isAdmin && contract.status === 'borrador' && latest && (
            <form action={setContractStatus.bind(null, contractId, 'en_revision')}>
              <button className="text-sm px-3 py-1.5 rounded bg-blue-600 text-white hover:bg-blue-700 cursor-pointer">
                Publicar para revisión del cliente
              </button>
            </form>
          )}
          {isAdmin && contract.status === 'borrador' && !latest && (
            <span className="text-xs text-slate-400">Sube el documento para poder publicarlo.</span>
          )}
          {!isAdmin && contract.status === 'en_revision' && (
            <form action={setContractStatus.bind(null, contractId, 'aprobado')}>
              <button className="text-sm px-3 py-1.5 rounded bg-emerald-600 text-white hover:bg-emerald-700 cursor-pointer">
                ✓ Dar visto bueno
              </button>
            </form>
          )}
          {isAdmin &&
            contract.status !== 'anulado' &&
            contract.status !== 'borrador' &&
            contract.status !== 'vigente' && (
              <form action={setContractStatus.bind(null, contractId, 'anulado')}>
                <button className="text-sm px-3 py-1.5 rounded border border-slate-300 hover:bg-slate-50 cursor-pointer">
                  Anular
                </button>
              </form>
            )}
          {isAdmin && (
            <form action={deleteContract.bind(null, contractId)} className="ml-auto">
              <button className="text-xs text-red-600 hover:underline cursor-pointer">
                Eliminar contrato
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
                  <div className="flex-1">
                    <FileField name="evidence" label="Adjuntar evidencia" />
                  </div>
                  <button
                    type="submit"
                    className="text-sm px-3 py-1.5 rounded bg-slate-800 text-white hover:bg-slate-700 cursor-pointer"
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
              className="text-sm px-3 py-1.5 rounded bg-blue-600 text-white hover:bg-blue-700 self-end cursor-pointer"
            >
              Enviar
            </button>
          </form>
        )}
        </div>
      </div>
    </>
  );
}
