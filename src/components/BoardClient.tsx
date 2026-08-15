'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import InfoTip from '@/components/InfoTip';
import {
  COLUMNS,
  COLUMN_HELP,
  DATE_PRESET_LABEL,
  type Attachment,
  type Comment,
  type DatePreset,
  type Ticket,
  type TicketStaging,
  type TicketStatus,
  type TicketType,
  type TicketPriority,
} from '@/lib/types';

const TYPE_LABEL: Record<TicketType, string> = { feature: 'Feature', bug: 'Bug', mejora: 'Mejora' };
const TYPE_COLOR: Record<TicketType, string> = {
  feature: 'bg-blue-600',
  bug: 'bg-red-600',
  mejora: 'bg-purple-600',
};
const PRIORITY_LABEL: Record<TicketPriority, string> = { baja: 'Baja', media: 'Media', alta: 'Alta' };
const PRIORITY_COLOR: Record<TicketPriority, string> = {
  baja: 'bg-emerald-50 text-emerald-700',
  media: 'bg-amber-50 text-amber-700',
  alta: 'bg-red-50 text-red-700',
};

const ADMIN_NEXT_ACTION: Partial<Record<TicketStatus, { label: string; target: TicketStatus }>> = {
  solicitudes: { label: 'Aceptar y mover a Backlog', target: 'backlog' },
  backlog: { label: 'Mover a En Desarrollo', target: 'en_desarrollo' },
  en_desarrollo: { label: 'Enviar a revisión', target: 'en_revision' },
};

const TIP_SOLICITUD =
  '💡 Aprovecha para dejar todo claro: agrega detalles, adjunta archivos o comenta lo que falte. Una vez aceptemos esta solicitud, no podrá devolverse a esta etapa.';

function fmtDate(iso: string) {
  try {
    return new Date(iso).toLocaleString('es', {
      day: '2-digit',
      month: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return '';
  }
}

function fmtDesiredDate(t: Ticket) {
  if (t.date_preset) return DATE_PRESET_LABEL[t.date_preset];
  if (t.desired_date) {
    try {
      return new Date(t.desired_date + 'T00:00:00').toLocaleDateString('es', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
      });
    } catch {
      return t.desired_date;
    }
  }
  return null;
}

function formatBytes(n: number | null) {
  if (!n) return '';
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

export default function BoardClient({
  projectId,
  currentUserId,
  currentUserName,
  isAdmin,
}: {
  projectId: string;
  currentUserId: string;
  currentUserName: string;
  isAdmin: boolean;
}) {
  const supabase = createClient();
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [reads, setReads] = useState<Record<string, string>>({});
  const [live, setLive] = useState<'connecting' | 'on' | 'off'>('connecting');
  const dragTicketId = useRef<string | null>(null);

  const [newTicketStatus, setNewTicketStatus] = useState<TicketStatus | null>(null);
  const [newTitle, setNewTitle] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [newType, setNewType] = useState<TicketType>('feature');
  const [newPriority, setNewPriority] = useState<TicketPriority>('media');
  const [newDatePreset, setNewDatePreset] = useState<DatePreset | ''>('');
  const [newDesiredDate, setNewDesiredDate] = useState('');

  const [openTicket, setOpenTicket] = useState<Ticket | null>(null);
  const [editing, setEditing] = useState(false);
  const [editTitle, setEditTitle] = useState('');
  const [editDesc, setEditDesc] = useState('');
  const [editType, setEditType] = useState<TicketType>('feature');
  const [editPriority, setEditPriority] = useState<TicketPriority>('media');
  const [editDatePreset, setEditDatePreset] = useState<DatePreset | ''>('');
  const [editDesiredDate, setEditDesiredDate] = useState('');

  const [comments, setComments] = useState<Comment[]>([]);
  const [newComment, setNewComment] = useState('');
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [uploading, setUploading] = useState(false);

  // Links de staging por ticket. La RLS de ticket_staging decide qué llega:
  // el admin recibe todos, el cliente solo los de tarjetas en revisión/hecho.
  const [staging, setStaging] = useState<Record<string, string>>({});
  const [editingStaging, setEditingStaging] = useState(false);
  const [stagingInput, setStagingInput] = useState('');

  const loadTickets = useCallback(async () => {
    // El nombre explícito de la FK (tickets_created_by_fkey) es obligatorio:
    // attachments y ticket_reads también unen tickets<->profiles, así que sin
    // desambiguar PostgREST responde 300 (PGRST201, embed ambiguo).
    const { data, error } = await supabase
      .from('tickets')
      .select('*, author:profiles!tickets_created_by_fkey(full_name)')
      .eq('project_id', projectId)
      .order('created_at', { ascending: true })
      .returns<Ticket[]>();
    if (error) {
      console.error('Error cargando tarjetas:', error);
      alert('No se pudieron cargar las tarjetas: ' + error.message);
      return;
    }
    if (data) {
      setTickets(data);
      const ids = data.map((t) => t.id);
      if (ids.length) {
        const { data: readRows } = await supabase
          .from('ticket_reads')
          .select('ticket_id, last_seen_at')
          .eq('user_id', currentUserId)
          .in('ticket_id', ids);
        const map: Record<string, string> = {};
        (readRows || []).forEach((r) => {
          map[r.ticket_id as string] = r.last_seen_at as string;
        });
        setReads(map);

        const { data: stagingRows } = await supabase
          .from('ticket_staging')
          .select('ticket_id, url')
          .in('ticket_id', ids)
          .returns<TicketStaging[]>();
        const smap: Record<string, string> = {};
        (stagingRows || []).forEach((s) => {
          smap[s.ticket_id] = s.url;
        });
        setStaging(smap);
      }
    }
  }, [projectId, supabase, currentUserId]);

  const loadComments = useCallback(
    async (ticketId: string) => {
      const { data, error } = await supabase
        .from('comments')
        .select('*, author:profiles!comments_author_id_fkey(full_name)')
        .eq('ticket_id', ticketId)
        .order('created_at', { ascending: true })
        .returns<Comment[]>();
      if (error) {
        console.error('Error cargando comentarios:', error);
        alert('No se pudieron cargar los comentarios: ' + error.message);
        return;
      }
      if (data) setComments(data);
    },
    [supabase]
  );

  const loadAttachments = useCallback(
    async (ticketId: string) => {
      const { data, error } = await supabase
        .from('attachments')
        .select('*')
        .eq('ticket_id', ticketId)
        .order('created_at', { ascending: true })
        .returns<Attachment[]>();
      if (error) {
        console.error('Error cargando adjuntos:', error);
        return;
      }
      if (data) setAttachments(data);
    },
    [supabase]
  );

  useEffect(() => {
    // Carga inicial al montar; no es una sincronización con props/estado externo.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadTickets();

    const channel = supabase
      .channel(`board-${projectId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tickets' }, () => {
        loadTickets();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'comments' }, () => {
        setOpenTicket((current) => {
          if (current) loadComments(current.id);
          return current;
        });
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'attachments' }, () => {
        setOpenTicket((current) => {
          if (current) loadAttachments(current.id);
          return current;
        });
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'ticket_staging' }, () => {
        loadTickets();
      })
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') setLive('on');
        else if (['CHANNEL_ERROR', 'TIMED_OUT', 'CLOSED'].includes(status)) setLive('off');
      });

    return () => {
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId]);

  function isUnread(t: Ticket) {
    const seen = reads[t.id];
    if (!seen) return true;
    return new Date(seen).getTime() < new Date(t.last_activity_at).getTime();
  }

  async function markRead(ticketId: string) {
    await supabase
      .from('ticket_reads')
      .upsert({ ticket_id: ticketId, user_id: currentUserId, last_seen_at: new Date().toISOString() });
    setReads((prev) => ({ ...prev, [ticketId]: new Date().toISOString() }));
  }

  async function moveTicket(id: string, status: TicketStatus) {
    const { error } = await supabase.from('tickets').update({ status }).eq('id', id);
    if (error) alert('No se pudo mover: ' + error.message);
    loadTickets();
  }

  function canClientEdit(t: Ticket) {
    return t.status === 'solicitudes' || t.status === 'en_revision';
  }

  async function createTicket() {
    if (!newTitle.trim() || !newTicketStatus) return;
    const { error } = await supabase.from('tickets').insert({
      project_id: projectId,
      title: newTitle.trim(),
      description: newDesc.trim(),
      type: newType,
      priority: newPriority,
      status: newTicketStatus,
      date_preset: newDatePreset || null,
      desired_date: newDatePreset ? null : newDesiredDate || null,
      created_by: currentUserId,
    });
    if (error) {
      alert('No se pudo crear: ' + error.message);
      return;
    }
    setNewTicketStatus(null);
    setNewTitle('');
    setNewDesc('');
    setNewType('feature');
    setNewPriority('media');
    setNewDatePreset('');
    setNewDesiredDate('');
    loadTickets();
  }

  function startEdit(t: Ticket) {
    setEditTitle(t.title);
    setEditDesc(t.description || '');
    setEditType(t.type);
    setEditPriority(t.priority);
    setEditDatePreset(t.date_preset || '');
    setEditDesiredDate(t.desired_date || '');
    setEditing(true);
  }

  async function saveEdit() {
    if (!openTicket || !editTitle.trim()) return;
    const { error } = await supabase
      .from('tickets')
      .update({
        title: editTitle.trim(),
        description: editDesc.trim(),
        type: editType,
        priority: editPriority,
        date_preset: editDatePreset || null,
        desired_date: editDatePreset ? null : editDesiredDate || null,
      })
      .eq('id', openTicket.id);
    if (error) {
      alert('No se pudo guardar: ' + error.message);
      return;
    }
    setEditing(false);
    loadTickets();
    const { data } = await supabase
      .from('tickets')
      .select('*, author:profiles!tickets_created_by_fkey(full_name)')
      .eq('id', openTicket.id)
      .single<Ticket>();
    if (data) setOpenTicket(data);
  }

  async function approveTicket() {
    if (!openTicket) return;
    const { error } = await supabase.from('tickets').update({ status: 'hecho' }).eq('id', openTicket.id);
    if (error) {
      alert('No se pudo aprobar: ' + error.message);
      return;
    }
    setOpenTicket({ ...openTicket, status: 'hecho' });
    loadTickets();
  }

  async function deleteTicket() {
    if (!openTicket || !isAdmin) return;
    if (!confirm('¿Eliminar esta tarjeta y sus comentarios?')) return;
    const { error } = await supabase.from('tickets').delete().eq('id', openTicket.id);
    if (error) {
      alert('No se pudo eliminar: ' + error.message);
      return;
    }
    setOpenTicket(null);
    loadTickets();
  }

  async function saveStaging() {
    if (!openTicket) return;
    const raw = stagingInput.trim();

    if (!raw) {
      const { error } = await supabase.from('ticket_staging').delete().eq('ticket_id', openTicket.id);
      if (error) {
        alert('No se pudo quitar el link: ' + error.message);
        return;
      }
      setStaging((prev) => {
        const next = { ...prev };
        delete next[openTicket.id];
        return next;
      });
      setEditingStaging(false);
      return;
    }

    let parsed: URL;
    try {
      parsed = new URL(raw);
    } catch {
      alert('Ese link no es una URL válida. Incluye https:// al inicio.');
      return;
    }
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      alert('El link debe empezar con http:// o https://');
      return;
    }

    const { error } = await supabase.from('ticket_staging').upsert({
      ticket_id: openTicket.id,
      url: parsed.toString(),
      updated_by: currentUserId,
      updated_at: new Date().toISOString(),
    });
    if (error) {
      alert('No se pudo guardar el link: ' + error.message);
      return;
    }
    setStaging((prev) => ({ ...prev, [openTicket.id]: parsed.toString() }));
    setEditingStaging(false);
  }

  async function sendComment() {
    if (!newComment.trim() || !openTicket) return;
    const { error } = await supabase.from('comments').insert({
      ticket_id: openTicket.id,
      author_id: currentUserId,
      body: newComment.trim(),
    });
    if (error) {
      alert('No se pudo comentar: ' + error.message);
      return;
    }
    setNewComment('');
    loadComments(openTicket.id);
  }

  async function handleUpload(files: FileList | null) {
    if (!files || !files.length || !openTicket) return;
    setUploading(true);
    for (const file of Array.from(files)) {
      const path = `${openTicket.id}/${Date.now()}-${file.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
      const { error: upErr } = await supabase.storage.from('ticket-attachments').upload(path, file);
      if (upErr) {
        alert('No se pudo subir ' + file.name + ': ' + upErr.message);
        continue;
      }
      await supabase.from('attachments').insert({
        ticket_id: openTicket.id,
        uploaded_by: currentUserId,
        storage_path: path,
        file_name: file.name,
        size_bytes: file.size,
        content_type: file.type,
      });
    }
    setUploading(false);
    loadAttachments(openTicket.id);
  }

  async function downloadAttachment(a: Attachment) {
    const { data, error } = await supabase.storage
      .from('ticket-attachments')
      .createSignedUrl(a.storage_path, 60);
    if (error || !data) {
      alert('No se pudo generar el link: ' + (error?.message || ''));
      return;
    }
    window.open(data.signedUrl, '_blank');
  }

  async function deleteAttachment(a: Attachment) {
    if (!confirm(`¿Eliminar "${a.file_name}"?`)) return;
    await supabase.storage.from('ticket-attachments').remove([a.storage_path]);
    await supabase.from('attachments').delete().eq('id', a.id);
    if (openTicket) loadAttachments(openTicket.id);
  }

  function openDetail(t: Ticket) {
    setOpenTicket(t);
    setEditing(false);
    setEditingStaging(false);
    setStagingInput(staging[t.id] || '');
    loadComments(t.id);
    loadAttachments(t.id);
    markRead(t.id);
  }

  const clientCanEditOpen = openTicket ? !isAdmin && canClientEdit(openTicket) : false;
  const editableNow = isAdmin || clientCanEditOpen;

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <div className="px-5 py-2 text-xs text-slate-500 flex items-center gap-2">
        <span
          className={`inline-block w-2 h-2 rounded-full ${
            live === 'on' ? 'bg-emerald-500' : live === 'off' ? 'bg-red-500' : 'bg-slate-300'
          }`}
        />
        {live === 'on' ? 'Conectado · en vivo' : live === 'off' ? 'Sin conexión en vivo' : 'Conectando…'}
        <span className="ml-auto">{currentUserName}</span>
      </div>

      <div className="flex-1 overflow-x-auto overflow-y-hidden px-5 pb-5 flex gap-3">
        {COLUMNS.map((col) => {
          const colTickets = tickets.filter((t) => t.status === col.key);
          const canCreateHere = isAdmin || col.key === 'solicitudes';
          return (
            <div key={col.key} className="bg-slate-100 rounded-lg min-w-[270px] max-w-[270px] flex flex-col">
              <div className="px-3 pt-3 pb-1 text-sm font-semibold text-slate-500 flex items-center gap-1.5 justify-between">
                <span className="flex items-center gap-1.5">
                  {col.label}
                  <InfoTip text={COLUMN_HELP[col.key]} />
                </span>
                <span>{colTickets.length}</span>
              </div>
              <div
                className="flex-1 overflow-y-auto px-2 pb-2 min-h-[40px]"
                onDragOver={(e) => {
                  if (isAdmin) e.preventDefault();
                }}
                onDrop={(e) => {
                  if (!isAdmin) return;
                  e.preventDefault();
                  if (dragTicketId.current) {
                    moveTicket(dragTicketId.current, col.key);
                    dragTicketId.current = null;
                  }
                }}
              >
                {colTickets.map((t) => (
                  <div
                    key={t.id}
                    draggable={isAdmin}
                    onDragStart={() => {
                      if (isAdmin) dragTicketId.current = t.id;
                    }}
                    onClick={() => openDetail(t)}
                    className="bg-white rounded-md px-2.5 py-2 mb-2 shadow-sm cursor-pointer text-sm hover:bg-slate-50 relative"
                  >
                    {isUnread(t) && (
                      <span className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-red-500" />
                    )}
                    <div className="mb-1.5 leading-snug">{t.title}</div>
                    <div className="flex gap-1.5 flex-wrap items-center">
                      <span className={`text-[11px] px-1.5 py-0.5 rounded text-white font-semibold ${TYPE_COLOR[t.type]}`}>
                        {TYPE_LABEL[t.type]}
                      </span>
                      <span className={`text-[11px] px-1.5 py-0.5 rounded font-semibold ${PRIORITY_COLOR[t.priority]}`}>
                        {PRIORITY_LABEL[t.priority]}
                      </span>
                      {staging[t.id] && (
                        <a
                          href={staging[t.id]}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={(e) => e.stopPropagation()}
                          title="Abrir preview"
                          className="text-[11px] px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 hover:bg-slate-200"
                        >
                          🔗 Preview
                        </a>
                      )}
                    </div>
                  </div>
                ))}
              </div>
              {canCreateHere && (
                <div className="px-2 pb-2.5">
                  <button
                    className="w-full text-left text-sm text-slate-500 hover:bg-slate-200 hover:text-slate-800 rounded px-1 py-1.5"
                    onClick={() => setNewTicketStatus(col.key)}
                  >
                    + Nueva tarjeta
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {newTicketStatus && (
        <div className="fixed inset-0 bg-slate-900/50 flex items-center justify-center p-5 z-50">
          <div className="bg-white rounded-lg max-w-md w-full p-5 max-h-[90vh] overflow-y-auto">
            <h2 className="font-semibold mb-3">Nueva tarjeta</h2>
            {newTicketStatus === 'solicitudes' && (
              <div className="mb-3 text-xs bg-amber-50 text-amber-800 rounded px-3 py-2">{TIP_SOLICITUD}</div>
            )}
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1">Título</label>
                <input
                  className="w-full rounded border border-slate-300 px-3 py-2 text-sm"
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  placeholder="¿Qué se necesita?"
                  autoFocus
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1">Descripción</label>
                <textarea
                  className="w-full rounded border border-slate-300 px-3 py-2 text-sm min-h-[70px]"
                  value={newDesc}
                  onChange={(e) => setNewDesc(e.target.value)}
                  placeholder="Detalles, contexto, links..."
                />
              </div>
              <div className="flex gap-2">
                <div className="flex-1">
                  <label className="block text-xs font-semibold text-slate-500 mb-1">Tipo</label>
                  <select
                    className="w-full rounded border border-slate-300 px-2 py-2 text-sm"
                    value={newType}
                    onChange={(e) => setNewType(e.target.value as TicketType)}
                  >
                    <option value="feature">Feature</option>
                    <option value="bug">Bug</option>
                    <option value="mejora">Mejora</option>
                  </select>
                </div>
                <div className="flex-1">
                  <label className="block text-xs font-semibold text-slate-500 mb-1">Prioridad</label>
                  <select
                    className="w-full rounded border border-slate-300 px-2 py-2 text-sm"
                    value={newPriority}
                    onChange={(e) => setNewPriority(e.target.value as TicketPriority)}
                  >
                    <option value="baja">Baja</option>
                    <option value="media">Media</option>
                    <option value="alta">Alta</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-500 mb-1 flex items-center gap-1.5">
                  Fecha deseada
                  <InfoTip text="Es solo informativa: te ayuda a priorizar, pero no es un compromiso de entrega." />
                </label>
                <select
                  className="w-full rounded border border-slate-300 px-2 py-2 text-sm mb-2"
                  value={newDatePreset}
                  onChange={(e) => {
                    setNewDatePreset(e.target.value as DatePreset | '');
                    if (e.target.value) setNewDesiredDate('');
                  }}
                >
                  <option value="">Sin preferencia</option>
                  <option value="esta_semana">Esta semana</option>
                  <option value="proximas_2_semanas">Próximas 2 semanas</option>
                  <option value="este_mes">Este mes</option>
                  <option value="sin_prisa">Sin prisa</option>
                </select>
                <input
                  type="date"
                  className="w-full rounded border border-slate-300 px-3 py-2 text-sm"
                  value={newDesiredDate}
                  disabled={!!newDatePreset}
                  onChange={(e) => setNewDesiredDate(e.target.value)}
                />
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-5">
              <button
                className="text-sm px-3 py-1.5 rounded border border-slate-300"
                onClick={() => setNewTicketStatus(null)}
              >
                Cancelar
              </button>
              <button
                className="text-sm px-3 py-1.5 rounded bg-blue-600 text-white hover:bg-blue-700"
                onClick={createTicket}
              >
                Crear tarjeta
              </button>
            </div>
          </div>
        </div>
      )}

      {openTicket && (
        <div className="fixed inset-0 bg-slate-900/50 flex items-center justify-center p-5 z-50">
          <div className="bg-white rounded-lg max-w-lg w-full p-5 max-h-[90vh] overflow-y-auto">
            {!editing ? (
              <>
                <div className="flex items-start justify-between gap-2 mb-2">
                  <h2 className="font-semibold">{openTicket.title}</h2>
                  {editableNow && (
                    <button
                      className="text-xs text-blue-600 hover:underline shrink-0"
                      onClick={() => startEdit(openTicket)}
                    >
                      Editar
                    </button>
                  )}
                </div>
                <div className="flex gap-1.5 mb-3 flex-wrap items-center">
                  <span className={`text-[11px] px-1.5 py-0.5 rounded text-white font-semibold ${TYPE_COLOR[openTicket.type]}`}>
                    {TYPE_LABEL[openTicket.type]}
                  </span>
                  <span className={`text-[11px] px-1.5 py-0.5 rounded font-semibold ${PRIORITY_COLOR[openTicket.priority]}`}>
                    {PRIORITY_LABEL[openTicket.priority]}
                  </span>
                  {fmtDesiredDate(openTicket) && (
                    <span className="text-[11px] px-1.5 py-0.5 rounded bg-slate-100 text-slate-600">
                      📅 {fmtDesiredDate(openTicket)}
                    </span>
                  )}
                </div>
                {!isAdmin && openTicket.status === 'solicitudes' && (
                  <div className="mb-3 text-xs bg-amber-50 text-amber-800 rounded px-3 py-2">{TIP_SOLICITUD}</div>
                )}
                <div className="mb-3">
                  <label className="block text-xs font-semibold text-slate-500 mb-1">Descripción</label>
                  <div className="text-sm whitespace-pre-wrap">{openTicket.description || '(sin descripción)'}</div>
                </div>

                {!editableNow && (
                  <div className="mb-3 text-xs text-slate-400">
                    Ya no se puede editar esta tarjeta en este estado, pero puedes comentar.
                  </div>
                )}

                <div className="text-xs text-slate-400 mb-3">
                  Creado por {openTicket.author?.full_name || 'desconocido'} · {fmtDate(openTicket.created_at)}
                </div>

                <div className="flex flex-wrap gap-2 mb-4">
                  {isAdmin && ADMIN_NEXT_ACTION[openTicket.status] && (
                    <button
                      className="text-sm px-3 py-1.5 rounded bg-blue-600 text-white hover:bg-blue-700"
                      onClick={() => {
                        const action = ADMIN_NEXT_ACTION[openTicket.status]!;
                        moveTicket(openTicket.id, action.target);
                        setOpenTicket({ ...openTicket, status: action.target });
                      }}
                    >
                      {ADMIN_NEXT_ACTION[openTicket.status]!.label}
                    </button>
                  )}
                  {isAdmin && (
                    <select
                      className="text-sm rounded border border-slate-300 px-2 py-1.5"
                      value=""
                      onChange={(e) => {
                        const status = e.target.value as TicketStatus;
                        if (!status) return;
                        moveTicket(openTicket.id, status);
                        setOpenTicket({ ...openTicket, status });
                      }}
                    >
                      <option value="">Mover manualmente a...</option>
                      {COLUMNS.filter((c) => c.key !== openTicket.status).map((c) => (
                        <option key={c.key} value={c.key}>
                          {c.label}
                        </option>
                      ))}
                    </select>
                  )}
                  {!isAdmin && openTicket.status === 'en_revision' && (
                    <button
                      className="text-sm px-3 py-1.5 rounded bg-emerald-600 text-white hover:bg-emerald-700"
                      onClick={approveTicket}
                    >
                      ✓ Aprobar
                    </button>
                  )}
                </div>

                {(isAdmin || staging[openTicket.id]) && (
                  <div className="border-t border-slate-200 pt-3 mb-3">
                    <div className="flex items-center justify-between mb-2">
                      <label className="text-xs font-semibold text-slate-500 flex items-center gap-1.5">
                        Link de preview
                        {isAdmin && (
                          <InfoTip text="Solo tú puedes ponerlo. El cliente lo ve únicamente cuando la tarjeta llega a En Revisión o Hecho." />
                        )}
                      </label>
                      {isAdmin && !editingStaging && (
                        <button
                          className="text-xs text-blue-600 hover:underline cursor-pointer"
                          onClick={() => {
                            setStagingInput(staging[openTicket.id] || '');
                            setEditingStaging(true);
                          }}
                        >
                          {staging[openTicket.id] ? 'Cambiar' : '+ Agregar'}
                        </button>
                      )}
                    </div>

                    {editingStaging ? (
                      <div className="flex gap-2">
                        <input
                          type="url"
                          className="flex-1 rounded border border-slate-300 px-3 py-1.5 text-sm"
                          placeholder="https://mi-proyecto.vercel.app"
                          value={stagingInput}
                          onChange={(e) => setStagingInput(e.target.value)}
                        />
                        <button
                          className="text-sm px-3 py-1.5 rounded bg-blue-600 text-white hover:bg-blue-700"
                          onClick={saveStaging}
                        >
                          Guardar
                        </button>
                        <button
                          className="text-sm px-2 py-1.5 rounded border border-slate-300"
                          onClick={() => setEditingStaging(false)}
                        >
                          Cancelar
                        </button>
                      </div>
                    ) : staging[openTicket.id] ? (
                      <a
                        href={staging[openTicket.id]}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm text-blue-600 hover:underline break-all"
                      >
                        🔗 {staging[openTicket.id]}
                      </a>
                    ) : (
                      <div className="text-xs text-slate-400">Sin link todavía.</div>
                    )}

                    {isAdmin && editingStaging && (
                      <div className="text-[11px] text-slate-400 mt-1">
                        Deja el campo vacío y guarda para quitar el link.
                      </div>
                    )}
                  </div>
                )}

                <div className="border-t border-slate-200 pt-3">
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-xs font-semibold text-slate-500">Archivos adjuntos</label>
                    <label className="text-xs text-blue-600 hover:underline cursor-pointer">
                      {uploading ? 'Subiendo...' : '+ Subir'}
                      <input
                        type="file"
                        multiple
                        className="hidden"
                        disabled={uploading}
                        onChange={(e) => handleUpload(e.target.files)}
                      />
                    </label>
                  </div>
                  {attachments.length === 0 && (
                    <div className="text-xs text-slate-400 mb-2">Sin archivos todavía.</div>
                  )}
                  <ul className="space-y-1 mb-2">
                    {attachments.map((a) => (
                      <li key={a.id} className="flex items-center gap-2 text-sm">
                        <button
                          className="text-blue-600 hover:underline text-left truncate cursor-pointer"
                          onClick={() => downloadAttachment(a)}
                        >
                          {a.file_name}
                        </button>
                        <span className="text-[11px] text-slate-400">{formatBytes(a.size_bytes)}</span>
                        {(isAdmin || a.uploaded_by === currentUserId) && (
                          <button
                            className="text-[11px] text-red-500 hover:underline ml-auto cursor-pointer"
                            onClick={() => deleteAttachment(a)}
                          >
                            eliminar
                          </button>
                        )}
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="border-t border-slate-200 pt-3 max-h-[220px] overflow-y-auto space-y-2.5">
                  {comments.map((c) => (
                    <div key={c.id} className="text-sm">
                      <div className="text-[11px] text-slate-400">
                        {c.author?.full_name || 'anon'} · {fmtDate(c.created_at)}
                      </div>
                      <div className="whitespace-pre-wrap">{c.body}</div>
                    </div>
                  ))}
                  {comments.length === 0 && <div className="text-sm text-slate-400">Sin comentarios todavía.</div>}
                </div>

                <div className="flex gap-2 mt-3">
                  <textarea
                    className="flex-1 rounded border border-slate-300 px-3 py-2 text-sm min-h-[40px]"
                    placeholder="Escribe un comentario..."
                    value={newComment}
                    onChange={(e) => setNewComment(e.target.value)}
                  />
                  <button
                    className="text-sm px-3 py-1.5 rounded bg-blue-600 text-white hover:bg-blue-700 self-end"
                    onClick={sendComment}
                  >
                    Enviar
                  </button>
                </div>

                <div className="flex justify-between mt-5">
                  {isAdmin ? (
                    <button className="text-sm text-red-600 hover:underline" onClick={deleteTicket}>
                      Eliminar tarjeta
                    </button>
                  ) : (
                    <span />
                  )}
                  <button
                    className="text-sm px-3 py-1.5 rounded border border-slate-300"
                    onClick={() => setOpenTicket(null)}
                  >
                    Cerrar
                  </button>
                </div>
              </>
            ) : (
              <>
                <h2 className="font-semibold mb-3">Editar tarjeta</h2>
                <div className="space-y-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-500 mb-1">Título</label>
                    <input
                      className="w-full rounded border border-slate-300 px-3 py-2 text-sm"
                      value={editTitle}
                      onChange={(e) => setEditTitle(e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-500 mb-1">Descripción</label>
                    <textarea
                      className="w-full rounded border border-slate-300 px-3 py-2 text-sm min-h-[70px]"
                      value={editDesc}
                      onChange={(e) => setEditDesc(e.target.value)}
                    />
                  </div>
                  <div className="flex gap-2">
                    <div className="flex-1">
                      <label className="block text-xs font-semibold text-slate-500 mb-1">Tipo</label>
                      <select
                        className="w-full rounded border border-slate-300 px-2 py-2 text-sm"
                        value={editType}
                        onChange={(e) => setEditType(e.target.value as TicketType)}
                      >
                        <option value="feature">Feature</option>
                        <option value="bug">Bug</option>
                        <option value="mejora">Mejora</option>
                      </select>
                    </div>
                    <div className="flex-1">
                      <label className="block text-xs font-semibold text-slate-500 mb-1">Prioridad</label>
                      <select
                        className="w-full rounded border border-slate-300 px-2 py-2 text-sm"
                        value={editPriority}
                        onChange={(e) => setEditPriority(e.target.value as TicketPriority)}
                      >
                        <option value="baja">Baja</option>
                        <option value="media">Media</option>
                        <option value="alta">Alta</option>
                      </select>
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-500 mb-1">Fecha deseada</label>
                    <select
                      className="w-full rounded border border-slate-300 px-2 py-2 text-sm mb-2"
                      value={editDatePreset}
                      onChange={(e) => {
                        setEditDatePreset(e.target.value as DatePreset | '');
                        if (e.target.value) setEditDesiredDate('');
                      }}
                    >
                      <option value="">Sin preferencia</option>
                      <option value="esta_semana">Esta semana</option>
                      <option value="proximas_2_semanas">Próximas 2 semanas</option>
                      <option value="este_mes">Este mes</option>
                      <option value="sin_prisa">Sin prisa</option>
                    </select>
                    <input
                      type="date"
                      className="w-full rounded border border-slate-300 px-3 py-2 text-sm"
                      value={editDesiredDate}
                      disabled={!!editDatePreset}
                      onChange={(e) => setEditDesiredDate(e.target.value)}
                    />
                  </div>
                </div>
                <div className="flex justify-end gap-2 mt-5">
                  <button
                    className="text-sm px-3 py-1.5 rounded border border-slate-300"
                    onClick={() => setEditing(false)}
                  >
                    Cancelar
                  </button>
                  <button
                    className="text-sm px-3 py-1.5 rounded bg-blue-600 text-white hover:bg-blue-700"
                    onClick={saveEdit}
                  >
                    Guardar cambios
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
