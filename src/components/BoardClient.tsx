'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { COLUMNS, type Comment, type Ticket, type TicketStatus, type TicketType, type TicketPriority } from '@/lib/types';

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

export default function BoardClient({
  projectId,
  currentUserId,
  currentUserName,
}: {
  projectId: string;
  currentUserId: string;
  currentUserName: string;
}) {
  const supabase = createClient();
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [live, setLive] = useState<'connecting' | 'on' | 'off'>('connecting');
  const dragTicketId = useRef<string | null>(null);

  const [newTicketStatus, setNewTicketStatus] = useState<TicketStatus | null>(null);
  const [newTitle, setNewTitle] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [newType, setNewType] = useState<TicketType>('feature');
  const [newPriority, setNewPriority] = useState<TicketPriority>('media');

  const [openTicket, setOpenTicket] = useState<Ticket | null>(null);
  const [comments, setComments] = useState<Comment[]>([]);
  const [newComment, setNewComment] = useState('');

  const loadTickets = useCallback(async () => {
    const { data, error } = await supabase
      .from('tickets')
      .select('*, author:profiles(full_name)')
      .eq('project_id', projectId)
      .order('created_at', { ascending: true })
      .returns<Ticket[]>();
    if (!error && data) setTickets(data);
  }, [projectId, supabase]);

  const loadComments = useCallback(
    async (ticketId: string) => {
      const { data, error } = await supabase
        .from('comments')
        .select('*, author:profiles(full_name)')
        .eq('ticket_id', ticketId)
        .order('created_at', { ascending: true })
        .returns<Comment[]>();
      if (!error && data) setComments(data);
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
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') setLive('on');
        else if (['CHANNEL_ERROR', 'TIMED_OUT', 'CLOSED'].includes(status)) setLive('off');
      });

    return () => {
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId]);

  async function moveTicket(id: string, status: TicketStatus) {
    const { error } = await supabase.from('tickets').update({ status }).eq('id', id);
    if (error) alert('No se pudo mover: ' + error.message);
    loadTickets();
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
    loadTickets();
  }

  async function deleteTicket() {
    if (!openTicket) return;
    if (!confirm('¿Eliminar esta tarjeta y sus comentarios?')) return;
    const { error } = await supabase.from('tickets').delete().eq('id', openTicket.id);
    if (error) {
      alert('No se pudo eliminar (puede que no tengas permiso): ' + error.message);
      return;
    }
    setOpenTicket(null);
    loadTickets();
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

  function openDetail(t: Ticket) {
    setOpenTicket(t);
    loadComments(t.id);
  }

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
          return (
            <div key={col.key} className="bg-slate-100 rounded-lg min-w-[270px] max-w-[270px] flex flex-col">
              <div className="px-3 pt-3 pb-1 text-sm font-semibold text-slate-500 flex justify-between">
                <span>{col.label}</span>
                <span>{colTickets.length}</span>
              </div>
              <div
                className="flex-1 overflow-y-auto px-2 pb-2 min-h-[40px]"
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
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
                    draggable
                    onDragStart={() => {
                      dragTicketId.current = t.id;
                    }}
                    onClick={() => openDetail(t)}
                    className="bg-white rounded-md px-2.5 py-2 mb-2 shadow-sm cursor-pointer text-sm hover:bg-slate-50"
                  >
                    <div className="mb-1.5 leading-snug">{t.title}</div>
                    <div className="flex gap-1.5 flex-wrap items-center">
                      <span className={`text-[11px] px-1.5 py-0.5 rounded text-white font-semibold ${TYPE_COLOR[t.type]}`}>
                        {TYPE_LABEL[t.type]}
                      </span>
                      <span className={`text-[11px] px-1.5 py-0.5 rounded font-semibold ${PRIORITY_COLOR[t.priority]}`}>
                        {PRIORITY_LABEL[t.priority]}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
              <div className="px-2 pb-2.5">
                <button
                  className="w-full text-left text-sm text-slate-500 hover:bg-slate-200 hover:text-slate-800 rounded px-1 py-1.5"
                  onClick={() => setNewTicketStatus(col.key)}
                >
                  + Nueva tarjeta
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {newTicketStatus && (
        <div className="fixed inset-0 bg-slate-900/50 flex items-center justify-center p-5 z-50">
          <div className="bg-white rounded-lg max-w-md w-full p-5">
            <h2 className="font-semibold mb-4">Nueva tarjeta</h2>
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
            <h2 className="font-semibold mb-2">{openTicket.title}</h2>
            <div className="flex gap-1.5 mb-3">
              <span className={`text-[11px] px-1.5 py-0.5 rounded text-white font-semibold ${TYPE_COLOR[openTicket.type]}`}>
                {TYPE_LABEL[openTicket.type]}
              </span>
              <span className={`text-[11px] px-1.5 py-0.5 rounded font-semibold ${PRIORITY_COLOR[openTicket.priority]}`}>
                {PRIORITY_LABEL[openTicket.priority]}
              </span>
            </div>
            <div className="mb-3">
              <label className="block text-xs font-semibold text-slate-500 mb-1">Descripción</label>
              <div className="text-sm whitespace-pre-wrap">{openTicket.description || '(sin descripción)'}</div>
            </div>
            <div className="mb-3">
              <label className="block text-xs font-semibold text-slate-500 mb-1">Estado</label>
              <select
                className="w-full rounded border border-slate-300 px-2 py-2 text-sm"
                value={openTicket.status}
                onChange={(e) => {
                  const status = e.target.value as TicketStatus;
                  setOpenTicket({ ...openTicket, status });
                  moveTicket(openTicket.id, status);
                }}
              >
                {COLUMNS.map((c) => (
                  <option key={c.key} value={c.key}>
                    {c.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="text-xs text-slate-400 mb-3">
              Creado por {openTicket.author?.full_name || 'desconocido'} · {fmtDate(openTicket.created_at)}
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
              <button className="text-sm text-red-600 hover:underline" onClick={deleteTicket}>
                Eliminar tarjeta
              </button>
              <button
                className="text-sm px-3 py-1.5 rounded border border-slate-300"
                onClick={() => setOpenTicket(null)}
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
