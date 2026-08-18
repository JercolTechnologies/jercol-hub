'use client';

import { useCallback, useEffect, useState } from 'react';
import AvisoFlotante, { useMensaje } from '@/components/AvisoFlotante';
import { createClient } from '@/lib/supabase/client';
import type { IdeaAttachment } from '@/lib/types';

function formatBytes(n: number | null) {
  if (!n) return '';
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

export default function IdeaAttachments({
  ideaId,
  currentUserId,
  isAdmin,
  canUpload,
}: {
  ideaId: string;
  currentUserId: string;
  isAdmin: boolean;
  canUpload: boolean;
}) {
  const supabase = createClient();
  const { mensaje, mostrar, limpiar } = useMensaje();
  const [attachments, setAttachments] = useState<IdeaAttachment[]>([]);
  const [uploading, setUploading] = useState(false);

  const load = useCallback(async () => {
    const { data, error } = await supabase
      .from('idea_attachments')
      .select('*')
      .eq('idea_id', ideaId)
      .order('created_at', { ascending: true })
      .returns<IdeaAttachment[]>();
    if (error) {
      console.error('Error cargando adjuntos de la idea:', error);
      return;
    }
    if (data) setAttachments(data);
  }, [ideaId, supabase]);

  useEffect(() => {
    // Carga inicial al montar.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ideaId]);

  async function handleUpload(files: FileList | null) {
    if (!files || !files.length) return;
    setUploading(true);
    for (const file of Array.from(files)) {
      const path = `${ideaId}/${Date.now()}-${file.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
      const { error: upErr } = await supabase.storage.from('idea-attachments').upload(path, file);
      if (upErr) {
        mostrar('No se pudo subir ' + file.name + ': ' + upErr.message);
        continue;
      }
      const { error: insErr } = await supabase.from('idea_attachments').insert({
        idea_id: ideaId,
        uploaded_by: currentUserId,
        storage_path: path,
        file_name: file.name,
        size_bytes: file.size,
        content_type: file.type,
      });
      if (insErr) mostrar('Se subió el archivo pero no se registró: ' + insErr.message);
    }
    setUploading(false);
    load();
  }

  async function download(a: IdeaAttachment) {
    const { data, error } = await supabase.storage
      .from('idea-attachments')
      .createSignedUrl(a.storage_path, 60);
    if (error || !data) {
      mostrar('No se pudo generar el link: ' + (error?.message || ''));
      return;
    }
    window.open(data.signedUrl, '_blank');
  }

  async function remove(a: IdeaAttachment) {
    if (!confirm(`¿Eliminar "${a.file_name}"?`)) return;
    await supabase.storage.from('idea-attachments').remove([a.storage_path]);
    const { error } = await supabase.from('idea_attachments').delete().eq('id', a.id);
    if (error) {
      mostrar('No se pudo eliminar: ' + error.message);
      return;
    }
    load();
  }

  return (
    <div className="border-t border-borde pt-4 mb-4">
      <div className="flex items-center justify-between mb-2">
        <label className="text-xs font-semibold text-tinta-suave">Archivos adjuntos</label>
        {canUpload && (
          <label className="text-xs text-azul hover:underline cursor-pointer">
            {uploading ? 'Subiendo...' : '+ Subir'}
            <input
              type="file"
              multiple
              className="hidden"
              disabled={uploading}
              onChange={(e) => handleUpload(e.target.files)}
            />
          </label>
        )}
      </div>
      {attachments.length === 0 && (
        <div className="text-xs text-tinta-suave/80">Sin archivos todavía.</div>
      )}
      <ul className="space-y-1">
        {attachments.map((a) => (
          <li key={a.id} className="flex items-center gap-2 text-sm">
            <button
              className="text-azul hover:underline text-left truncate cursor-pointer"
              onClick={() => download(a)}
            >
              {a.file_name}
            </button>
            <span className="text-[11px] text-tinta-suave/80">{formatBytes(a.size_bytes)}</span>
            {(isAdmin || a.uploaded_by === currentUserId) && (
              <button
                className="text-[11px] text-alerta hover:underline ml-auto cursor-pointer"
                onClick={() => remove(a)}
              >
                eliminar
              </button>
            )}
          </li>
        ))}
      </ul>

      <AvisoFlotante mensaje={mensaje} onCerrar={limpiar} />
    </div>
  );
}
