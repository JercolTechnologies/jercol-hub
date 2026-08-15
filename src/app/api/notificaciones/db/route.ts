import { NextResponse, type NextRequest } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { adminProfileIds, clientProfileIds, notifyMany } from '@/lib/telegram/client';
import {
  msgAprobada,
  msgCambioEstado,
  msgComentario,
  msgSolicitudNueva,
} from '@/lib/telegram/mensajes';
import type { TicketStatus } from '@/lib/types';

export const dynamic = 'force-dynamic';

/**
 * Recibe los Database Webhooks de Supabase para lo que ocurre en el tablero.
 *
 * Va por aquí y no desde la app porque el tablero escribe directamente desde
 * el navegador (necesario para el tiempo real). Si el aviso dependiera del
 * navegador, se perdería cuando el usuario cierra la pestaña justo después.
 * Disparando desde la base de datos, el aviso sale sí o sí.
 */

interface Payload {
  type: 'INSERT' | 'UPDATE' | 'DELETE';
  table: string;
  record: Record<string, unknown> | null;
  old_record: Record<string, unknown> | null;
}

/** Contexto de un ticket: proyecto, cliente y nombre, en una sola consulta. */
async function ticketContext(ticketId: string) {
  const admin = createAdminClient();
  const { data } = await admin
    .from('tickets')
    .select('id, title, project_id, status, projects(name, client_id)')
    .eq('id', ticketId)
    .maybeSingle();

  if (!data) return null;
  const project = data.projects as unknown as { name: string; client_id: string } | null;
  if (!project) return null;

  return {
    ticketId: data.id as string,
    titulo: data.title as string,
    projectId: data.project_id as string,
    proyecto: project.name,
    clientId: project.client_id,
    status: data.status as TicketStatus,
  };
}

async function nombreDe(profileId: string | null): Promise<{ nombre: string; esAdmin: boolean }> {
  if (!profileId) return { nombre: 'Alguien', esAdmin: false };

  const admin = createAdminClient();
  const { data } = await admin
    .from('profiles')
    .select('full_name, email, role')
    .eq('id', profileId)
    .maybeSingle();

  return {
    nombre: (data?.full_name as string) || (data?.email as string) || 'Alguien',
    esAdmin: data?.role === 'admin',
  };
}

export async function POST(request: NextRequest) {
  const secret = process.env.NOTIFY_WEBHOOK_SECRET;
  if (!secret || request.headers.get('x-notify-secret') !== secret) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  let payload: Payload;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ ok: true });
  }

  try {
    // ---------------- Comentario nuevo ----------------
    if (payload.table === 'comments' && payload.type === 'INSERT' && payload.record) {
      const ticketId = payload.record.ticket_id as string;
      const autorId = (payload.record.author_id as string) || null;
      const commentId = payload.record.id as string;

      const ctx = await ticketContext(ticketId);
      if (!ctx) return NextResponse.json({ ok: true });

      const autor = await nombreDe(autorId);
      const texto = msgComentario({
        autor: autor.nombre,
        tarjeta: ctx.titulo,
        cuerpo: (payload.record.body as string) || '',
        projectId: ctx.projectId,
      });

      // Le llega a la otra parte: si comentó el cliente, avisa a Jercol; si
      // comentó Jercol, avisa al equipo del cliente (menos al propio autor).
      const destinatarios = autor.esAdmin
        ? await clientProfileIds(ctx.clientId)
        : await adminProfileIds();

      await notifyMany(destinatarios, `comment:${commentId}`, texto);
      return NextResponse.json({ ok: true });
    }

    // ---------------- Ticket nuevo ----------------
    if (payload.table === 'tickets' && payload.type === 'INSERT' && payload.record) {
      const creadorId = (payload.record.created_by as string) || null;
      const autor = await nombreDe(creadorId);

      // Solo interesa cuando la solicitud viene del cliente.
      if (autor.esAdmin) return NextResponse.json({ ok: true });

      const ctx = await ticketContext(payload.record.id as string);
      if (!ctx) return NextResponse.json({ ok: true });

      const texto = msgSolicitudNueva({
        autor: autor.nombre,
        proyecto: ctx.proyecto,
        titulo: ctx.titulo,
        projectId: ctx.projectId,
      });

      await notifyMany(await adminProfileIds(), `ticket:${ctx.ticketId}`, texto);
      return NextResponse.json({ ok: true });
    }

    // ---------------- Cambio de estado ----------------
    if (
      payload.table === 'tickets' &&
      payload.type === 'UPDATE' &&
      payload.record &&
      payload.old_record
    ) {
      const antes = payload.old_record.status as TicketStatus;
      const despues = payload.record.status as TicketStatus;
      if (antes === despues) return NextResponse.json({ ok: true });

      const ctx = await ticketContext(payload.record.id as string);
      if (!ctx) return NextResponse.json({ ok: true });

      // El cliente aprobando (en_revision -> hecho) le interesa a Jercol.
      if (antes === 'en_revision' && despues === 'hecho') {
        const texto = msgAprobada({
          tarjeta: ctx.titulo,
          cliente: ctx.proyecto,
          projectId: ctx.projectId,
        });
        await notifyMany(await adminProfileIds(), `approved:${ctx.ticketId}:${despues}`, texto);
        return NextResponse.json({ ok: true });
      }

      // El resto de movimientos los hace Jercol: le interesan al cliente.
      const texto = msgCambioEstado({
        tarjeta: ctx.titulo,
        desde: antes,
        hasta: despues,
        projectId: ctx.projectId,
      });
      await notifyMany(
        await clientProfileIds(ctx.clientId),
        `status:${ctx.ticketId}:${despues}`,
        texto
      );
      return NextResponse.json({ ok: true });
    }
  } catch (e) {
    // Nunca devolver error: Supabase reintentaría y podría duplicar avisos.
    console.error('webhook notificaciones:', e);
  }

  return NextResponse.json({ ok: true });
}
