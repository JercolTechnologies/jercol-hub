'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { notify } from '@/lib/telegram/client';

/**
 * Solo el responsable de una organización gestiona a su equipo.
 *
 * Jercol no interviene aquí a propósito: quién trabaja dentro de una empresa
 * es asunto de esa empresa, no del proveedor.
 */
async function requireOwner() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single();

  if (!profile?.is_owner || !profile.client_id) redirect('/');
  return { supabase, user, profile };
}

export async function resolverSolicitud(profileId: string, aprobar: boolean) {
  const { supabase, profile } = await requireOwner();

  // El .eq sobre client_id evita que un responsable pueda tocar el perfil de
  // alguien de otra organización aunque manipule el id que se envía.
  const { error } = await supabase
    .from('profiles')
    .update({ member_status: aprobar ? 'activo' : 'rechazado' })
    .eq('id', profileId)
    .eq('client_id', profile.client_id);

  if (error) {
    console.error('resolverSolicitud:', error);
    redirect('/equipo?error=' + encodeURIComponent('No se pudo completar la acción.'));
  }

  await notify({
    profileId,
    eventKey: `member-${aprobar ? 'ok' : 'no'}:${profileId}`,
    text: aprobar
      ? '✅ <b>Ya tienes acceso</b>\nTu ingreso fue aprobado. Ya puedes entrar a Jercol Hub.'
      : 'Tu solicitud de ingreso no fue aprobada. Háblalo con quien administra la cuenta de tu organización.',
  });

  revalidatePath('/equipo');
  redirect('/equipo?ok=' + encodeURIComponent(aprobar ? 'Acceso aprobado.' : 'Solicitud rechazada.'));
}

export async function quitarMiembro(profileId: string) {
  const { supabase, user, profile } = await requireOwner();

  if (profileId === user.id) {
    redirect('/equipo?error=' + encodeURIComponent('No puedes quitarte a ti mismo.'));
  }

  await supabase
    .from('profiles')
    .update({ member_status: 'rechazado' })
    .eq('id', profileId)
    .eq('client_id', profile.client_id);

  revalidatePath('/equipo');
  redirect('/equipo?ok=' + encodeURIComponent('Acceso retirado.'));
}
