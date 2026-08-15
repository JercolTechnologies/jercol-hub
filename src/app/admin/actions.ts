'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { clientProfileIds, notifyMany } from '@/lib/telegram/client';
import { msgProyectoNuevo } from '@/lib/telegram/mensajes';

async function requireAdmin() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single();

  if (!profile || profile.role !== 'admin') redirect('/');
  return supabase;
}

export async function createClientOrg(formData: FormData) {
  const supabase = await requireAdmin();
  const name = String(formData.get('name') || '').trim();
  if (!name) return;
  await supabase.from('clients').insert({ name });
  revalidatePath('/admin');
}

export async function createProject(clientId: string, formData: FormData) {
  const supabase = await requireAdmin();
  const name = String(formData.get('name') || '').trim();
  if (!name) return;

  const { data: project } = await supabase
    .from('projects')
    .insert({ client_id: clientId, name })
    .select('id')
    .single();

  if (project) {
    await notifyMany(
      await clientProfileIds(clientId),
      `project:${project.id}`,
      msgProyectoNuevo({ nombre: name, projectId: project.id as string })
    );
  }

  revalidatePath('/admin');
}

export async function assignUser(formData: FormData) {
  const supabase = await requireAdmin();
  const userId = String(formData.get('user_id') || '');
  const clientId = String(formData.get('client_id') || '');
  if (!userId || !clientId) return;
  await supabase.from('profiles').update({ client_id: clientId }).eq('id', userId);
  revalidatePath('/admin');
}

export async function setClientArchived(clientId: string, archived: boolean) {
  const supabase = await requireAdmin();
  await supabase.from('clients').update({ archived }).eq('id', clientId);
  revalidatePath('/admin');
}

export async function addContact(clientId: string, formData: FormData) {
  const supabase = await requireAdmin();
  const fullName = String(formData.get('full_name') || '').trim();
  if (!fullName) return;

  // Normaliza el teléfono a solo dígitos: wa.me no admite espacios ni signos.
  const rawPhone = String(formData.get('phone') || '').trim();
  const phone = rawPhone ? rawPhone.replace(/[^0-9]/g, '') : null;

  await supabase.from('client_contacts').insert({
    client_id: clientId,
    full_name: fullName,
    phone,
    email: String(formData.get('email') || '').trim() || null,
    role_label: String(formData.get('role_label') || '').trim() || null,
    is_legal_rep: formData.get('is_legal_rep') === 'on',
  });
  revalidatePath('/admin');
}

export async function deleteContact(contactId: string) {
  const supabase = await requireAdmin();
  await supabase.from('client_contacts').delete().eq('id', contactId);
  revalidatePath('/admin');
}

export async function linkContactProfile(contactId: string, formData: FormData) {
  const supabase = await requireAdmin();
  const profileId = String(formData.get('profile_id') || '');
  await supabase
    .from('client_contacts')
    .update({ profile_id: profileId || null })
    .eq('id', contactId);
  revalidatePath('/admin');
}

export async function setProjectStatus(projectId: string, status: 'activo' | 'terminado') {
  const supabase = await requireAdmin();
  await supabase
    .from('projects')
    .update({ status, finished_at: status === 'terminado' ? new Date().toISOString() : null })
    .eq('id', projectId);
  revalidatePath('/admin');
}
