'use client';

import { createClient } from '@/lib/supabase/client';

/**
 * Los documentos del expediente están en un bucket privado, así que se pide
 * una URL firmada de corta duración en el momento del click.
 */
export default function ClientDocLink({ path, label }: { path: string; label: string }) {
  const supabase = createClient();

  async function abrir() {
    const { data, error } = await supabase.storage
      .from('client-documents')
      .createSignedUrl(path, 120);

    if (error || !data) {
      alert('No se pudo abrir el documento: ' + (error?.message || ''));
      return;
    }
    window.open(data.signedUrl, '_blank', 'noopener,noreferrer');
  }

  return (
    <button
      type="button"
      onClick={abrir}
      className="text-sm text-blue-600 hover:underline cursor-pointer text-left"
    >
      {label}
    </button>
  );
}
