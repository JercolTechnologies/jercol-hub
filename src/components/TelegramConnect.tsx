'use client';

import { useState, useTransition } from 'react';

/**
 * El enlace de vinculación lleva un código de un solo uso, así que se pide en
 * el momento de conectar y no se renderiza de antemano: si se generara al
 * cargar la página, cada visita quemaría un código.
 */
export default function TelegramConnect({
  crearEnlace,
}: {
  crearEnlace: () => Promise<string | null>;
}) {
  const [url, setUrl] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState('');

  function generar() {
    setError('');
    startTransition(async () => {
      const link = await crearEnlace();
      if (!link) {
        setError('No se pudo generar el enlace. Avísale al administrador.');
        return;
      }
      setUrl(link);
      window.open(link, '_blank', 'noopener,noreferrer');
    });
  }

  if (url) {
    return (
      <div className="text-sm">
        <p className="mb-2">
          Se abrió Telegram en otra pestaña. Pulsa <b>Iniciar</b> en el chat del bot para
          terminar de conectar.
        </p>
        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className="text-blue-600 hover:underline break-all"
        >
          {url}
        </a>
        <p className="text-xs text-slate-400 mt-2">
          El código vence en 15 minutos. Si no alcanzas, genera otro.
        </p>
      </div>
    );
  }

  return (
    <div>
      <button
        type="button"
        onClick={generar}
        disabled={pending}
        className="text-sm px-3 py-1.5 rounded bg-blue-600 text-white hover:bg-blue-700 cursor-pointer disabled:bg-slate-200 disabled:text-slate-400"
      >
        {pending ? 'Generando…' : 'Conectar Telegram'}
      </button>
      {error && <div className="text-xs text-red-600 mt-1">{error}</div>}
    </div>
  );
}
