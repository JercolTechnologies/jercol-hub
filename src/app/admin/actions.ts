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

  // Se fuerza member_status: si la cuenta venía de un rechazo o de una
  // solicitud pendiente, asignarla sin activarla la dejaba dentro de la
  // organización pero sin ver nada, porque my_client_id() exige miembro activo.
  await supabase
    .from('profiles')
    .update({ client_id: clientId, member_status: 'activo' })
    .eq('id', userId);

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

/**
 * Verifica o rechaza el expediente de un cliente.
 *
 * Queda constancia de quién verificó y cuándo: eso es lo que después sostiene
 * que la firma del contrato la hizo el representante legal y no cualquiera.
 *
 * No hace falta limpiar verified_at, verified_by ni rejection_reason al
 * rechazar: el trigger trg_client_verification_fields (migración 014) los
 * deja coherentes con el estado pase lo que pase. Se hizo así a propósito,
 * para que la coherencia no dependa de que quien escriba la próxima función
 * que toque `status` se acuerde de limpiarlos.
 */
export async function verificarCliente(clientId: string, formData: FormData) {
  const supabase = await requireAdmin();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const aprobar = String(formData.get('decision') || '') === 'aprobar';
  const motivo = String(formData.get('rejection_reason') || '').trim();

  if (!aprobar && !motivo) {
    revalidatePath('/admin');
    return;
  }

  await supabase
    .from('clients')
    .update(
      aprobar
        ? {
            status: 'verificado',
            verified_at: new Date().toISOString(),
            verified_by: user?.id ?? null,
            rejection_reason: null,
          }
        : { status: 'rechazado', rejection_reason: motivo }
    )
    .eq('id', clientId);

  // Se avisa a todo el equipo del cliente: el responsable puede no ser quien
  // esté pendiente del resultado.
  const { data: miembros } = await supabase
    .from('profiles')
    .select('id')
    .eq('client_id', clientId);

  const ids = (miembros || []).map((m) => m.id as string);
  if (ids.length) {
    await notifyMany(
      ids,
      `client-${aprobar ? 'ok' : 'no'}:${clientId}`,
      aprobar
        ? '✅ <b>Registro verificado</b>\nYa puedes empezar a trabajar en Jercol Hub.'
        : `⚠️ <b>Registro no verificado</b>\n${motivo}`
    );
  }

  revalidatePath('/admin');
}

/**
 * Devuelve un cliente rechazado a la cola de verificación.
 *
 * El rechazo se diseñó como un final y en la práctica casi siempre va a ser
 * "te faltó un papel". Sin esta vuelta atrás, un rechazo por error dejaba al
 * cliente sin salida: tendría que registrarse con otro correo y otro NIT.
 */
export async function reabrirVerificacion(clientId: string) {
  const supabase = await requireAdmin();

  await supabase
    .from('clients')
    .update({ status: 'pendiente', rejection_reason: null })
    .eq('id', clientId);

  const { data: miembros } = await supabase
    .from('profiles')
    .select('id')
    .eq('client_id', clientId);

  const ids = (miembros || []).map((m) => m.id as string);
  if (ids.length) {
    await notifyMany(
      ids,
      `client-reabierto:${clientId}:${Date.now()}`,
      '🔄 <b>Registro reabierto</b>\nPuedes corregir o volver a subir tus documentos.'
    );
  }

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
