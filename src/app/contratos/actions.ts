'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import type { ContractStatus } from '@/lib/types';

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
