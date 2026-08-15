'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

/**
 * Las páginas renderizadas en servidor no se enteran solas de los cambios.
 * Este componente se suscribe a las tablas indicadas y pide a Next.js que
 * vuelva a renderizar la página cuando algo cambia.
 */
export default function RealtimeRefresh({
  channel,
  tables,
}: {
  channel: string;
  tables: string[];
}) {
  const router = useRouter();
  const key = tables.join(',');

  useEffect(() => {
    const supabase = createClient();
    const ch = supabase.channel(channel);

    key.split(',').forEach((table) => {
      ch.on('postgres_changes', { event: '*', schema: 'public', table }, () => {
        router.refresh();
      });
    });

    ch.subscribe();

    return () => {
      supabase.removeChannel(ch);
    };
  }, [channel, key, router]);

  return null;
}
