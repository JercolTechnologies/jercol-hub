'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';

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
  await supabase.from('projects').insert({ client_id: clientId, name });
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
