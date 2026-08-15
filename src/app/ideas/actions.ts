'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { adminProfileIds, clientProfileIds, notifyMany } from '@/lib/telegram/client';
import { msgIdeaNueva, msgProyectoNuevo } from '@/lib/telegram/mensajes';

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

  const { data: idea } = await supabase
    .from('project_ideas')
    .insert({ client_id: profile.client_id, title, description, created_by: user.id })
    .select('id')
    .single();

  if (idea) {
    await notifyMany(
      await adminProfileIds(),
      `idea:${idea.id}`,
      msgIdeaNueva({
        autor: profile.full_name || profile.email || 'Un cliente',
        titulo: title,
        ideaId: idea.id as string,
      })
    );
  }

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

  if (project) {
    await notifyMany(
      await clientProfileIds(clientId),
      `project:${project.id}`,
      msgProyectoNuevo({ nombre: name, projectId: project.id as string })
    );
  }

  revalidatePath('/ideas');
  revalidatePath(`/ideas/${ideaId}`);
  // El redirect va al final: lanza una excepción interna de Next para navegar,
  // así que cualquier cosa después de esta línea no se ejecutaría.
  if (project) redirect(`/board/${project.id}`);
}
