'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';

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

export async function createIdea(formData: FormData) {
  const { supabase, user, profile } = await requireUser();
  const title = String(formData.get('title') || '').trim();
  const description = String(formData.get('description') || '').trim();
  if (!title || !profile.client_id) return;
  await supabase
    .from('project_ideas')
    .insert({ client_id: profile.client_id, title, description, created_by: user.id });
  revalidatePath('/ideas');
}

export async function addIdeaComment(ideaId: string, formData: FormData) {
  const { supabase, user } = await requireUser();
  const body = String(formData.get('body') || '').trim();
  if (!body) return;
  await supabase.from('project_idea_comments').insert({ idea_id: ideaId, author_id: user.id, body });
  revalidatePath(`/ideas/${ideaId}`);
}

export async function setIdeaStatus(ideaId: string, status: 'en_conversacion' | 'descartada') {
  const { supabase, profile } = await requireUser();
  if (profile.role !== 'admin') return;
  await supabase.from('project_ideas').update({ status }).eq('id', ideaId);
  revalidatePath(`/ideas/${ideaId}`);
  revalidatePath('/ideas');
}

export async function convertIdeaToProject(ideaId: string, clientId: string, formData: FormData) {
  const { supabase, profile } = await requireUser();
  if (profile.role !== 'admin') return;
  const name = String(formData.get('name') || '').trim();
  if (!name) return;
  const { data: project } = await supabase
    .from('projects')
    .insert({ client_id: clientId, name })
    .select()
    .single();
  await supabase.from('project_ideas').update({ status: 'convertida' }).eq('id', ideaId);
  revalidatePath('/ideas');
  revalidatePath(`/ideas/${ideaId}`);
  if (project) redirect(`/board/${project.id}`);
}
