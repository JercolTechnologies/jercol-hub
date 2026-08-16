'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { adminProfileIds, notifyMany, escapeHtml } from '@/lib/telegram/client';
import type { ClientDocumentKind, ClientKind } from '@/lib/types';

async function requireUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');
  return { supabase, user };
}

function err(msg: string, ruta: string): never {
  redirect(`${ruta}?error=${encodeURIComponent(msg)}`);
}

/** Deja solo dígitos y guion: los NIT suelen escribirse con puntos y espacios. */
function normalizarDocumento(valor: string) {
  return valor.replace(/[^0-9-]/g, '');
}

async function subirDocumento(
  supabase: Awaited<ReturnType<typeof createClient>>,
  clientId: string,
  userId: string,
  file: File,
  kind: ClientDocumentKind
) {
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
  const path = `${clientId}/${kind}-${Date.now()}-${safeName}`;

  const { error: upErr } = await supabase.storage
    .from('client-documents')
    .upload(path, file, { contentType: file.type || undefined });

  if (upErr) {
    console.error('subirDocumento:', upErr);
    return false;
  }

  const { error } = await supabase.from('client_documents').insert({
    client_id: clientId,
    kind,
    storage_path: path,
    file_name: file.name,
    size_bytes: file.size,
    uploaded_by: userId,
  });

  if (error) console.error('registrar documento:', error);
  return !error;
}

/** Alta de una empresa o persona natural nueva, con su expediente. */
export async function registrarEmpresa(formData: FormData) {
  const { supabase, user } = await requireUser();
  const RUTA = '/registro/empresa';

  const kind = String(formData.get('kind') || 'juridica') as ClientKind;
  const name = String(formData.get('name') || '').trim();
  const taxId = normalizarDocumento(String(formData.get('tax_id') || ''));
  const consent = formData.get('data_consent') === 'on';

  if (!name) err('Escribe el nombre o razón social.', RUTA);
  if (!taxId) err(kind === 'juridica' ? 'Escribe el NIT.' : 'Escribe el número de cédula.', RUTA);
  if (!consent) err('Necesitamos tu autorización para tratar los documentos.', RUTA);

  const rut = formData.get('doc_rut') as File | null;
  const cedulaFrente = formData.get('doc_cedula') as File | null;
  const cedulaReverso = formData.get('doc_cedula_reverso') as File | null;
  if (!rut || rut.size === 0) err('Adjunta el RUT.', RUTA);
  if (!cedulaFrente || cedulaFrente.size === 0) err('Adjunta la cara frontal de la cédula.', RUTA);
  if (!cedulaReverso || cedulaReverso.size === 0)
    err('Adjunta el reverso de la cédula.', RUTA);

  // Se comprueba antes de insertar para poder dar un mensaje entendible.
  // El índice único de la base es la garantía real si dos personas envían
  // el formulario a la vez.
  const { data: existente } = await supabase
    .from('clients')
    .select('id, name')
    .eq('tax_id', taxId)
    .maybeSingle();

  if (existente) {
    err(
      'Ese documento ya está registrado en Jercol Hub. Si eres parte de esa organización, ' +
        'usa la opción "Unirme a una empresa ya registrada".',
      RUTA
    );
  }

  const { data: cliente, error: cErr } = await supabase
    .from('clients')
    .insert({
      name,
      kind,
      tax_id: taxId,
      address: String(formData.get('address') || '').trim() || null,
      city: String(formData.get('city') || '').trim() || null,
      phone: String(formData.get('phone') || '').trim() || null,
      status: 'pendiente',
      registered_by: user.id,
      data_consent_at: new Date().toISOString(),
    })
    .select('id')
    .single();

  if (cErr || !cliente) {
    console.error('registrarEmpresa:', cErr);
    // Se muestra el detalle real: un "algo falló" genérico obliga a ir a
    // buscar los logs del servidor para saber qué pasó.
    err(`No se pudo registrar: ${cErr?.message ?? 'error desconocido'}`, RUTA);
  }

  await subirDocumento(supabase, cliente.id, user.id, rut, 'rut');
  await subirDocumento(supabase, cliente.id, user.id, cedulaFrente, 'cedula');
  await subirDocumento(supabase, cliente.id, user.id, cedulaReverso, 'cedula_reverso');

  const camara = formData.get('doc_camara') as File | null;
  if (camara && camara.size > 0) {
    await subirDocumento(supabase, cliente.id, user.id, camara, 'camara');
  }

  // Quien registra queda como responsable de la cuenta de su organización.
  await supabase
    .from('profiles')
    .update({
      client_id: cliente.id,
      member_status: 'activo',
      is_owner: true,
      job_title: String(formData.get('job_title') || '').trim() || null,
    })
    .eq('id', user.id);

  // El representante legal queda como contacto, que es de donde sale el
  // firmante autorizado de los contratos.
  const esRep = formData.get('registrant_is_rep') === 'on';
  const repNombre =
    kind === 'natural' ? name : String(formData.get('rep_full_name') || '').trim();
  const repDoc =
    kind === 'natural' ? taxId : String(formData.get('rep_document') || '').trim();

  if (repNombre) {
    await supabase.from('client_contacts').insert({
      client_id: cliente.id,
      full_name: repNombre,
      phone: String(formData.get('rep_phone') || formData.get('phone') || '').replace(/[^0-9]/g, '') || null,
      email: String(formData.get('rep_email') || '').trim() || null,
      role_label: repDoc ? `Doc. ${repDoc}` : null,
      is_legal_rep: true,
      // Si quien se registró declara ser el representante, su cuenta queda
      // habilitada para firmar. Si no, lo vincula Jercol después.
      profile_id: esRep ? user.id : null,
    });
  }

  await notifyMany(
    await adminProfileIds(),
    `client-registro:${cliente.id}`,
    `🏢 <b>Cliente nuevo por verificar</b>\n` +
      `${escapeHtml(name)} — ${escapeHtml(taxId)}\n\n` +
      `Revisa el expediente antes de habilitarlo.\n\n` +
      `${process.env.NEXT_PUBLIC_APP_URL || ''}/admin`
  );

  revalidatePath('/');
  redirect('/');
}

/** Solicitud para unirse a una organización ya registrada. */
export async function unirmeAEmpresa(formData: FormData) {
  const { supabase, user } = await requireUser();
  const RUTA = '/registro/unirme';

  const taxId = normalizarDocumento(String(formData.get('tax_id') || ''));
  const jobTitle = String(formData.get('job_title') || '').trim();

  if (!taxId) err('Escribe el NIT o cédula de la organización.', RUTA);
  if (!jobTitle) err('Escribe tu cargo.', RUTA);

  // La RLS de clients solo deja ver la propia organización, así que la
  // búsqueda pasa por una función acotada que devuelve id y nombre y nada más.
  const { data: encontrados } = await supabase.rpc('buscar_cliente_por_documento', {
    documento: taxId,
  });

  const cliente = Array.isArray(encontrados) ? encontrados[0] : encontrados;

  if (!cliente?.id) {
    err(
      'No encontramos ninguna organización con ese documento. Verifícalo con tu administrador, ' +
        'o registra la organización si eres el primero.',
      RUTA
    );
  }

  await supabase
    .from('profiles')
    .update({
      client_id: cliente.id as string,
      member_status: 'pendiente',
      is_owner: false,
      job_title: jobTitle,
    })
    .eq('id', user.id);

  // Aviso al responsable de esa organización, que es quien aprueba.
  const { data: owners } = await supabase.rpc('responsables_de_cliente', {
    cliente_id: cliente.id,
  });

  const ids = (Array.isArray(owners) ? owners : []).map((o: { id: string }) => o.id);
  if (ids.length) {
    const { data: yo } = await supabase
      .from('profiles')
      .select('full_name, email')
      .eq('id', user.id)
      .maybeSingle();

    await notifyMany(
      ids,
      `join-request:${user.id}`,
      `👥 <b>Alguien quiere unirse a tu equipo</b>\n` +
        `${escapeHtml((yo?.full_name as string) || (yo?.email as string) || '')} — ` +
        `${escapeHtml(jobTitle)}\n\n` +
        `Apruébalo o recházalo desde tu perfil.\n\n` +
        `${process.env.NEXT_PUBLIC_APP_URL || ''}/equipo`
    );
  }

  revalidatePath('/');
  redirect('/');
}
