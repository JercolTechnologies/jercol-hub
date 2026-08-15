'use server';

import { createHash } from 'crypto';
import { revalidatePath } from 'next/cache';
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { buildSignedPdf, type SignatureRecord } from '@/lib/pdf/certificacion';
import { adminProfileIds, clientProfileIds, notifyMany } from '@/lib/telegram/client';
import {
  msgContratoFirmado,
  msgContratoPublicado,
  msgVistoBueno,
} from '@/lib/telegram/mensajes';
import type { ContractStatus, SignerRole } from '@/lib/types';

async function requireUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');
  const { data: profile } = await supabase.from('profiles').select('*').eq('id', user.id).single();
  if (!profile) redirect('/login');
  return { supabase, user, profile };
}

async function requireAdmin() {
  const ctx = await requireUser();
  if (ctx.profile.role !== 'admin') redirect('/');
  return ctx;
}

export async function createContract(formData: FormData) {
  const { supabase, user } = await requireAdmin();
  const clientId = String(formData.get('client_id') || '');
  const title = String(formData.get('title') || '').trim();
  if (!clientId || !title) return;

  const { data: contract, error } = await supabase
    .from('contracts')
    .insert({ client_id: clientId, title, created_by: user.id })
    .select()
    .single();

  if (error || !contract) return;

  const projectIds = formData.getAll('project_ids').map(String).filter(Boolean);
  if (projectIds.length) {
    await supabase
      .from('contract_projects')
      .insert(projectIds.map((pid) => ({ contract_id: contract.id, project_id: pid })));
  }

  revalidatePath('/contratos');
  redirect(`/contratos/${contract.id}`);
}

export async function setContractStatus(contractId: string, status: ContractStatus) {
  const { supabase, profile } = await requireUser();

  // El cliente solo puede dar el visto bueno. Cualquier otra transición es del admin.
  // La RLS lo refuerza en la base de datos; esto solo evita el viaje inútil.
  if (profile.role !== 'admin' && status !== 'aprobado') return;

  const { error } = await supabase.from('contracts').update({ status }).eq('id', contractId);
  if (error) console.error('setContractStatus:', error);

  if (!error) {
    const { data: contract } = await supabase
      .from('contracts')
      .select('title, client_id')
      .eq('id', contractId)
      .maybeSingle();

    if (contract) {
      if (status === 'en_revision') {
        await notifyMany(
          await clientProfileIds(contract.client_id as string),
          `contract-published:${contractId}`,
          msgContratoPublicado({ titulo: contract.title as string, contractId })
        );
      } else if (status === 'aprobado') {
        await notifyMany(
          await adminProfileIds(),
          `contract-approved:${contractId}`,
          msgVistoBueno({
            titulo: contract.title as string,
            cliente: profile.full_name || profile.email || 'El cliente',
            contractId,
          })
        );
      }
    }
  }

  revalidatePath(`/contratos/${contractId}`);
  revalidatePath('/contratos');
}

export async function setContractSigner(contractId: string, formData: FormData) {
  const { supabase } = await requireAdmin();
  const contactId = String(formData.get('signer_contact_id') || '');
  await supabase
    .from('contracts')
    .update({ signer_contact_id: contactId || null })
    .eq('id', contractId);
  revalidatePath(`/contratos/${contractId}`);
}

export async function uploadVersion(contractId: string, formData: FormData) {
  const { supabase, user } = await requireAdmin();
  const file = formData.get('file') as File | null;
  if (!file || file.size === 0) return;

  const { data: last } = await supabase
    .from('contract_versions')
    .select('version_number')
    .eq('contract_id', contractId)
    .order('version_number', { ascending: false })
    .limit(1)
    .maybeSingle();

  const nextVersion = (last?.version_number || 0) + 1;
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
  const path = `${contractId}/v${nextVersion}-${Date.now()}-${safeName}`;

  const { error: upErr } = await supabase.storage
    .from('contracts')
    .upload(path, file, { contentType: file.type || 'application/pdf' });

  if (upErr) {
    console.error('uploadVersion storage:', upErr);
    return;
  }

  await supabase.from('contract_versions').insert({
    contract_id: contractId,
    version_number: nextVersion,
    storage_path: path,
    file_name: file.name,
    size_bytes: file.size,
    notes: String(formData.get('notes') || '').trim() || null,
    uploaded_by: user.id,
  });

  revalidatePath(`/contratos/${contractId}`);
}

export async function uploadPoder(contractId: string, formData: FormData) {
  const { supabase } = await requireAdmin();
  const file = formData.get('file') as File | null;
  if (!file || file.size === 0) return;

  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
  const path = `${contractId}/poder/${Date.now()}-${safeName}`;

  const { error: upErr } = await supabase.storage
    .from('contracts')
    .upload(path, file, { contentType: file.type || undefined });

  if (upErr) {
    console.error('uploadPoder storage:', upErr);
    return;
  }

  await supabase.from('contracts').update({ poder_path: path }).eq('id', contractId);
  revalidatePath(`/contratos/${contractId}`);
}

export async function updateContractProjects(contractId: string, formData: FormData) {
  const { supabase } = await requireAdmin();
  const projectIds = formData.getAll('project_ids').map(String).filter(Boolean);

  // Se reemplaza el conjunto completo: más simple y sin estados intermedios raros.
  await supabase.from('contract_projects').delete().eq('contract_id', contractId);
  if (projectIds.length) {
    await supabase
      .from('contract_projects')
      .insert(projectIds.map((pid) => ({ contract_id: contractId, project_id: pid })));
  }

  revalidatePath(`/contratos/${contractId}`);
}

export async function deleteContract(contractId: string) {
  const { supabase } = await requireAdmin();

  // Los archivos de Storage no se borran solos con el cascade de Postgres:
  // hay que recogerlos antes de perder las filas que los referencian.
  const [{ data: versions }, { data: addenda }, { data: contract }] = await Promise.all([
    supabase.from('contract_versions').select('storage_path').eq('contract_id', contractId),
    supabase.from('contract_addenda').select('evidence_path').eq('contract_id', contractId),
    supabase.from('contracts').select('poder_path').eq('id', contractId).single(),
  ]);

  const paths = [
    ...(versions || []).map((v) => v.storage_path as string),
    ...(addenda || []).map((a) => a.evidence_path as string | null),
    (contract?.poder_path as string | null) ?? null,
  ].filter((p): p is string => !!p);

  if (paths.length) {
    const { error } = await supabase.storage.from('contracts').remove(paths);
    if (error) console.error('deleteContract storage:', error);
  }

  await supabase.from('contracts').delete().eq('id', contractId);

  revalidatePath('/contratos');
  redirect('/contratos');
}

// ---------------------------------------------------------------------
// Firma
// ---------------------------------------------------------------------

function dataUrlToBytes(dataUrl: string): { bytes: Uint8Array; mime: string } | null {
  const match = /^data:(image\/(?:png|jpeg));base64,(.+)$/.exec(dataUrl);
  if (!match) return null;
  return { mime: match[1], bytes: new Uint8Array(Buffer.from(match[2], 'base64')) };
}

async function getRequestTrace() {
  const h = await headers();
  // En Vercel la IP real llega en x-forwarded-for; el primer valor es el cliente.
  const forwarded = h.get('x-forwarded-for');
  const ip = forwarded ? forwarded.split(',')[0].trim() : h.get('x-real-ip');
  return { ip: ip || null, userAgent: h.get('user-agent') };
}

export async function signContract(contractId: string, formData: FormData) {
  const { supabase, user, profile } = await requireUser();

  const fullName = String(formData.get('full_name') || '').trim();
  const documentId = String(formData.get('document_id') || '').trim();
  const signatureData = String(formData.get('signature_data') || '');
  if (!fullName || !documentId) return;

  const { data: contract } = await supabase
    .from('contracts')
    .select('*')
    .eq('id', contractId)
    .single();
  if (!contract) return;

  const isAdmin = profile.role === 'admin';
  const role: SignerRole = isAdmin ? 'jercol' : 'cliente';

  // ---- Orden y autorización ----
  // Jercol firma primero (desde 'aprobado'), el cliente después.
  if (isAdmin && contract.status !== 'aprobado') return;

  if (!isAdmin) {
    if (contract.status !== 'firmado_jercol') return;
    if (contract.client_id !== profile.client_id) return;

    // Solo la cuenta vinculada al contacto designado como firmante.
    const { data: signerContact } = await supabase
      .from('client_contacts')
      .select('id, profile_id')
      .eq('id', contract.signer_contact_id)
      .maybeSingle();

    if (!signerContact || signerContact.profile_id !== user.id) return;
  }

  // La versión vigente es la que se firma.
  const { data: version } = await supabase
    .from('contract_versions')
    .select('*')
    .eq('contract_id', contractId)
    .order('version_number', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!version) return;

  const admin = createAdminClient();

  // Huella del PDF tal como está al momento de firmar.
  const { data: fileBlob, error: dlErr } = await admin.storage
    .from('contracts')
    .download(version.storage_path);
  if (dlErr || !fileBlob) {
    console.error('signContract download:', dlErr);
    return;
  }
  const originalBytes = new Uint8Array(await fileBlob.arrayBuffer());
  const sha256 = createHash('sha256').update(originalBytes).digest('hex');

  // Imagen de la firma (opcional: el valor probatorio está en el rastro).
  let signaturePath: string | null = null;
  const parsed = signatureData ? dataUrlToBytes(signatureData) : null;
  if (parsed) {
    const ext = parsed.mime === 'image/jpeg' ? 'jpg' : 'png';
    const path = `${contractId}/firmas/${role}-${Date.now()}.${ext}`;
    const { error } = await admin.storage
      .from('contracts')
      .upload(path, parsed.bytes, { contentType: parsed.mime });
    if (error) console.error('signContract signature upload:', error);
    else signaturePath = path;
  }

  const trace = await getRequestTrace();

  const { error: sigErr } = await admin.from('contract_signatures').insert({
    contract_id: contractId,
    signer_role: role,
    profile_id: user.id,
    contact_id: isAdmin ? null : contract.signer_contact_id,
    version_id: version.id,
    full_name: fullName,
    document_id: documentId,
    signature_path: signaturePath,
    document_sha256: sha256,
    ip: trace.ip,
    user_agent: trace.userAgent,
  });

  if (sigErr) {
    console.error('signContract insert:', sigErr);
    return;
  }

  if (isAdmin) {
    await admin.from('contracts').update({ status: 'firmado_jercol' }).eq('id', contractId);

    // Avisa al cliente: ahora le toca firmar a él.
    await notifyMany(
      await clientProfileIds(contract.client_id),
      `contract-signed-jercol:${contractId}`,
      msgContratoFirmado({
        titulo: contract.title,
        quien: fullName,
        completo: false,
        contractId,
      })
    );

    revalidatePath(`/contratos/${contractId}`);
    revalidatePath('/contratos');
    return;
  }

  // ---- Segunda firma: se genera el PDF final ----
  const [{ data: signatures }, { data: client }] = await Promise.all([
    admin.from('contract_signatures').select('*').eq('contract_id', contractId),
    admin.from('clients').select('name').eq('id', contract.client_id).single(),
  ]);

  const records: SignatureRecord[] = [];
  for (const s of signatures || []) {
    let image: Uint8Array | null = null;
    let mime: string | null = null;
    if (s.signature_path) {
      const { data: blob } = await admin.storage.from('contracts').download(s.signature_path);
      if (blob) {
        image = new Uint8Array(await blob.arrayBuffer());
        mime = s.signature_path.endsWith('.jpg') ? 'image/jpeg' : 'image/png';
      }
    }
    records.push({
      rolLabel: s.signer_role === 'jercol' ? 'Firma de Jercol Technologies' : 'Firma del cliente',
      fullName: s.full_name,
      documentId: s.document_id,
      signedAt: s.signed_at,
      ip: s.ip,
      userAgent: s.user_agent,
      signatureImage: image,
      signatureMime: mime,
    });
  }
  records.sort((a) => (a.rolLabel.includes('Jercol') ? -1 : 1));

  try {
    const finalPdf = await buildSignedPdf({
      originalPdf: originalBytes,
      contractTitle: contract.title,
      clientName: client?.name || '',
      documentSha256: sha256,
      signatures: records,
    });

    const signedPath = `${contractId}/firmado/${Date.now()}-contrato-firmado.pdf`;
    const { error: upErr } = await admin.storage
      .from('contracts')
      .upload(signedPath, finalPdf, { contentType: 'application/pdf' });

    if (upErr) {
      console.error('signContract signed upload:', upErr);
      return;
    }

    // Una sola sentencia: el trigger de inmutabilidad bloquea cualquier
    // cambio posterior en cuanto el estado quede en 'vigente'.
    await admin
      .from('contracts')
      .update({ status: 'vigente', signed_path: signedPath, signed_at: new Date().toISOString() })
      .eq('id', contractId);

    // Contrato completo: se avisa a ambas partes.
    const texto = msgContratoFirmado({
      titulo: contract.title,
      quien: fullName,
      completo: true,
      contractId,
    });
    const destinatarios = [
      ...(await adminProfileIds()),
      ...(await clientProfileIds(contract.client_id)),
    ];
    await notifyMany(destinatarios, `contract-vigente:${contractId}`, texto);
  } catch (e) {
    console.error('signContract buildSignedPdf:', e);
    return;
  }

  revalidatePath(`/contratos/${contractId}`);
  revalidatePath('/contratos');
}

export async function addContractComment(contractId: string, formData: FormData) {
  const { supabase, user } = await requireUser();
  const body = String(formData.get('body') || '').trim();
  if (!body) return;
  await supabase
    .from('contract_comments')
    .insert({ contract_id: contractId, author_id: user.id, body });
  revalidatePath(`/contratos/${contractId}`);
}

export async function addAddendum(contractId: string, formData: FormData) {
  const { supabase, user } = await requireAdmin();
  const body = String(formData.get('body') || '').trim();
  const agreedOn = String(formData.get('agreed_on') || '');
  if (!body || !agreedOn) return;

  let evidencePath: string | null = null;
  const file = formData.get('evidence') as File | null;
  if (file && file.size > 0) {
    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
    const path = `${contractId}/adendas/${Date.now()}-${safeName}`;
    const { error: upErr } = await supabase.storage
      .from('contracts')
      .upload(path, file, { contentType: file.type || undefined });
    if (!upErr) evidencePath = path;
    else console.error('addAddendum storage:', upErr);
  }

  await supabase.from('contract_addenda').insert({
    contract_id: contractId,
    agreed_on: agreedOn,
    channel: String(formData.get('channel') || 'whatsapp'),
    counterpart: String(formData.get('counterpart') || '').trim() || null,
    body,
    evidence_path: evidencePath,
    created_by: user.id,
  });

  revalidatePath(`/contratos/${contractId}`);
}
