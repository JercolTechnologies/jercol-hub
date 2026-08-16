'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { adminProfileIds, notifyMany, escapeHtml } from '@/lib/telegram/client';
import type { ClientDocumentKind } from '@/lib/types';

/**
 * Reenvío del expediente después de un rechazo.
 *
 * Solo lo puede hacer quien registró la organización, y solo si está
 * rechazada. Se suben documentos nuevos —los anteriores se conservan, para
 * que quede el rastro de qué se aportó y cuándo— y vuelve a la cola.
 */
async function requireDuenoDeRechazado() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: profile } = await supabase
    .from('profiles')
    .select('client_id, is_owner')
    .eq('id', user.id)
    .maybeSingle();

  if (!profile?.client_id || !profile.is_owner) redirect('/');

  const { data: cliente } = await supabase
    .from('clients')
    .select('id, status')
    .eq('id', profile.client_id)
    .maybeSingle();

  if (!cliente || cliente.status !== 'rechazado') redirect('/');

  return { supabase, user, clientId: cliente.id as string };
}

export async function reenviarDocumentos(formData: FormData) {
  const { user, clientId } = await requireDuenoDeRechazado();
  const admin = createAdminClient();

  const archivos: { file: File; kind: ClientDocumentKind }[] = [];
  const rut = formData.get('doc_rut') as File | null;
  const ced = formData.get('doc_cedula') as File | null;
  const cedRev = formData.get('doc_cedula_reverso') as File | null;
  const camara = formData.get('doc_camara') as File | null;

  if (rut && rut.size > 0) archivos.push({ file: rut, kind: 'rut' });
  if (ced && ced.size > 0) archivos.push({ file: ced, kind: 'cedula' });
  if (cedRev && cedRev.size > 0) archivos.push({ file: cedRev, kind: 'cedula_reverso' });
  if (camara && camara.size > 0) archivos.push({ file: camara, kind: 'camara' });

  const nota = String(formData.get('nota') || '').trim();

  if (archivos.length === 0 && !nota) {
    redirect(
      '/registro/corregir?error=' +
        encodeURIComponent('Adjunta al menos un documento o escribe una aclaración.')
    );
  }

  for (const { file, kind } of archivos) {
    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
    const path = `${clientId}/${kind}-${Date.now()}-${safeName}`;

    const { error: upErr } = await admin.storage
      .from('client-documents')
      .upload(path, file, { contentType: file.type || undefined });

    if (upErr) {
      console.error('reenviarDocumentos storage:', upErr);
      redirect(
        '/registro/corregir?error=' +
          encodeURIComponent(`No se pudo guardar ${file.name}: ${upErr.message}`)
      );
    }

    await admin.from('client_documents').insert({
      client_id: clientId,
      kind,
      storage_path: path,
      file_name: file.name,
      size_bytes: file.size,
      uploaded_by: user.id,
    });
  }

  await admin
    .from('clients')
    .update({ status: 'pendiente', rejection_reason: null })
    .eq('id', clientId);

  const { data: cliente } = await admin
    .from('clients')
    .select('name, tax_id')
    .eq('id', clientId)
    .maybeSingle();

  await notifyMany(
    await adminProfileIds(),
    `client-reenvio:${clientId}:${Date.now()}`,
    `📎 <b>Documentos corregidos</b>\n` +
      `${escapeHtml((cliente?.name as string) || '')} — ${escapeHtml((cliente?.tax_id as string) || '')}\n` +
      (nota ? `\n<i>${escapeHtml(nota)}</i>\n` : '') +
      `\nVuelve a estar pendiente de verificar.\n\n` +
      `${process.env.NEXT_PUBLIC_APP_URL || ''}/admin`
  );

  revalidatePath('/');
  redirect('/');
}
