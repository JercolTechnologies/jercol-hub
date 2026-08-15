'use client';

import { createClient } from '@/lib/supabase/client';

/**
 * Los PDF viven en un bucket privado: no se pueden enlazar directo.
 * Este botón pide una URL firmada de corta duración en el momento del click.
 */
export default function ContractFileLink({
  path,
  label,
  // Tailwind v4 pone cursor de flecha en los botones por defecto: si este
  // botón se ve como enlace, hay que devolverle la manita explícitamente.
  className = 'text-sm text-blue-600 hover:underline text-left cursor-pointer',
}: {
  path: string;
  label: string;
  className?: string;
}) {
  const supabase = createClient();

  async function open() {
    const { data, error } = await supabase.storage.from('contracts').createSignedUrl(path, 120);
    if (error || !data) {
      alert('No se pudo abrir el archivo: ' + (error?.message || ''));
      return;
    }
    window.open(data.signedUrl, '_blank', 'noopener,noreferrer');
  }

  return (
    <button type="button" onClick={open} className={className}>
      {label}
    </button>
  );
}
