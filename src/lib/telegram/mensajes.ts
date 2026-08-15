import 'server-only';

import { escapeHtml } from '@/lib/telegram/client';
import { COLUMNS, type TicketStatus } from '@/lib/types';

/**
 * Textos de los avisos, en un solo lugar para poder ajustar el tono sin
 * tocar la lógica que decide a quién se le manda.
 *
 * Convenciones:
 * - Empiezan con un emoji que identifica el tipo de evento de un vistazo.
 * - Terminan con el enlace directo a lo que hay que mirar.
 * - Todo dato que venga de un usuario pasa por escapeHtml.
 */

function baseUrl() {
  // En Vercel esta variable la inyecta la plataforma; en local cae al puerto por defecto.
  const url = process.env.NEXT_PUBLIC_APP_URL || process.env.VERCEL_PROJECT_PRODUCTION_URL;
  if (!url) return 'http://localhost:3000';
  return url.startsWith('http') ? url : `https://${url}`;
}

export function linkTablero(projectId: string) {
  return `${baseUrl()}/board/${projectId}`;
}

export function linkContrato(contractId: string) {
  return `${baseUrl()}/contratos/${contractId}`;
}

export function linkIdea(ideaId: string) {
  return `${baseUrl()}/ideas/${ideaId}`;
}

function estadoLabel(status: TicketStatus) {
  return COLUMNS.find((c) => c.key === status)?.label ?? status;
}

// ---------------------------------------------------------------- Tablero

/**
 * Todos los avisos del tablero llevan la misma segunda línea: proyecto,
 * cliente y estado. Es lo que permite entender de qué va el mensaje sin
 * abrir la app — leyéndolo desde el celular en la calle, por ejemplo.
 */
function contexto(p: { proyecto: string; cliente?: string; estado: TicketStatus }) {
  const quien = p.cliente ? ` (${escapeHtml(p.cliente)})` : '';
  return `📁 ${escapeHtml(p.proyecto)}${quien} · ${escapeHtml(estadoLabel(p.estado))}\n`;
}

export function msgSolicitudNueva(p: {
  autor: string;
  proyecto: string;
  cliente?: string;
  titulo: string;
  projectId: string;
}) {
  return (
    `🆕 <b>Nueva solicitud</b>\n` +
    contexto({ proyecto: p.proyecto, cliente: p.cliente, estado: 'solicitudes' }) +
    `\n«${escapeHtml(p.titulo)}»\n` +
    `De: ${escapeHtml(p.autor)}\n\n` +
    linkTablero(p.projectId)
  );
}

export function msgComentario(p: {
  autor: string;
  tarjeta: string;
  cuerpo: string;
  proyecto: string;
  cliente?: string;
  estado: TicketStatus;
  projectId: string;
}) {
  const recorte = p.cuerpo.length > 300 ? p.cuerpo.slice(0, 300) + '…' : p.cuerpo;
  return (
    `💬 <b>Nuevo comentario</b>\n` +
    contexto({ proyecto: p.proyecto, cliente: p.cliente, estado: p.estado }) +
    `\n«${escapeHtml(p.tarjeta)}»\n` +
    `${escapeHtml(p.autor)}:\n${escapeHtml(recorte)}\n\n` +
    linkTablero(p.projectId)
  );
}

export function msgCambioEstado(p: {
  tarjeta: string;
  desde: TicketStatus;
  hasta: TicketStatus;
  proyecto: string;
  cliente?: string;
  projectId: string;
}) {
  const emoji = p.hasta === 'en_revision' ? '👀' : p.hasta === 'hecho' ? '✅' : '🔄';
  const extra = p.hasta === 'en_revision' ? '\n<i>Te toca revisar y aprobar.</i>' : '';

  return (
    `${emoji} <b>${escapeHtml(estadoLabel(p.hasta))}</b>\n` +
    contexto({ proyecto: p.proyecto, cliente: p.cliente, estado: p.hasta }) +
    `\n«${escapeHtml(p.tarjeta)}»\n` +
    `${escapeHtml(estadoLabel(p.desde))} → ${escapeHtml(estadoLabel(p.hasta))}${extra}\n\n` +
    linkTablero(p.projectId)
  );
}

export function msgAprobada(p: {
  tarjeta: string;
  proyecto: string;
  cliente?: string;
  projectId: string;
}) {
  return (
    `✅ <b>Tarjeta aprobada</b>\n` +
    contexto({ proyecto: p.proyecto, cliente: p.cliente, estado: 'hecho' }) +
    `\n«${escapeHtml(p.tarjeta)}» quedó aprobada por el cliente.\n\n` +
    linkTablero(p.projectId)
  );
}

// -------------------------------------------------------------- Contratos

export function msgContratoPublicado(p: { titulo: string; contractId: string }) {
  return (
    `📄 <b>Contrato para revisión</b>\n` +
    `«${escapeHtml(p.titulo)}» está listo para que lo revises.\n\n` +
    linkContrato(p.contractId)
  );
}

export function msgVistoBueno(p: { titulo: string; cliente: string; contractId: string }) {
  return (
    `👍 <b>Visto bueno</b>\n` +
    `${escapeHtml(p.cliente)} aprobó «${escapeHtml(p.titulo)}». Falta firmar.\n\n` +
    linkContrato(p.contractId)
  );
}

export function msgContratoFirmado(p: {
  titulo: string;
  quien: string;
  completo: boolean;
  contractId: string;
}) {
  const cabecera = p.completo
    ? '🖋 <b>Contrato firmado por ambas partes</b>'
    : '🖋 <b>Contrato firmado</b>';
  const cuerpo = p.completo
    ? `«${escapeHtml(p.titulo)}» quedó vigente. Ya puedes descargar el PDF con el certificado.`
    : `${escapeHtml(p.quien)} firmó «${escapeHtml(p.titulo)}».`;

  return `${cabecera}\n${cuerpo}\n\n` + linkContrato(p.contractId);
}

// ------------------------------------------------------- Ideas y proyectos

export function msgIdeaNueva(p: { autor: string; titulo: string; ideaId: string }) {
  return (
    `💡 <b>Nueva idea de proyecto</b>\n` +
    `${escapeHtml(p.autor)} propuso «${escapeHtml(p.titulo)}».\n\n` +
    linkIdea(p.ideaId)
  );
}

export function msgProyectoNuevo(p: { nombre: string; projectId: string }) {
  return (
    `📁 <b>Nuevo proyecto</b>\n` +
    `Se creó «${escapeHtml(p.nombre)}» y ya puedes verlo en tu tablero.\n\n` +
    linkTablero(p.projectId)
  );
}

// ----------------------------------------------------------------- Cuentas

export function msgCuentaNueva(p: { nombre: string; correo: string }) {
  return (
    `👤 <b>Cuenta nueva registrada</b>\n` +
    `${escapeHtml(p.nombre)} (${escapeHtml(p.correo)})\n\n` +
    `Falta asignarla a un cliente.\n\n` +
    `${baseUrl()}/admin`
  );
}

export function msgVinculacionOk(nombre: string) {
  return (
    `✅ <b>Telegram conectado</b>\n` +
    `Hola ${escapeHtml(nombre)}, a partir de ahora te aviso por aquí de lo que pase en ` +
    `Jercol Hub.\n\n` +
    `Puedes desactivar estos avisos cuando quieras desde tu perfil en la app.`
  );
}
