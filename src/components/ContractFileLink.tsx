'use client';

import AvisoFlotante, { useMensaje } from '@/components/AvisoFlotante';
import { createClient } from '@/lib/supabase/client';

/**
 * Los PDF viven en un bucket privado: no se pueden enlazar directo.
 * Este botón pide una URL firmada de corta duración en el momento del click.
 */
export default function ContractFileLink({
  path,
  label,
  className = 'text-sm text-azul hover:underline text-left',
}: {
  path: string;
  label: string;
  className?: string;
}) {
  const supabase = createClient();
  const { mensaje, mostrar, limpiar } = useMensaje();

  async function open() {
    const { data, error } = await supabase.storage.from('contracts').createSignedUrl(path, 120);
    if (error || !data) {
      mostrar('No se pudo abrir el archivo: ' + (error?.message || ''));
      return;
    }
    window.open(data.signedUrl, '_blank', 'noopener,noreferrer');
  }

  return (
    <>
      <button type="button" onClick={open} className={className}>
        {label}
      </button>
      <AvisoFlotante mensaje={mensaje} onCerrar={limpiar} />
    </>
  );
}
