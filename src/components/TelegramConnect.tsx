'use client';

import { useState, useTransition } from 'react';

/**
 * El enlace de vinculación lleva un código de un solo uso, así que se pide en
 * el momento de conectar y no se renderiza de antemano: si se generara al
 * cargar la página, cada visita quemaría un código.
 *
 * Además del enlace se ofrece la vía manual, porque `t.me` no siempre
 * resuelve —hay redes y proveedores que lo bloquean— y sin alternativa el
 * cliente se queda atascado sin saber qué hacer.
 */
export default function TelegramConnect({
  crearEnlace,
}: {
  crearEnlace: () => Promise<string | null>;
}) {
  const [url, setUrl] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState('');
  const [copiado, setCopiado] = useState(false);

  const bot = process.env.NEXT_PUBLIC_TELEGRAM_BOT_USERNAME || 'JercolHubBot';
  const codigo = url ? (url.split('start=')[1] ?? '') : '';
  const comando = `/start ${codigo}`;

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

  async function copiar() {
    try {
      await navigator.clipboard.writeText(comando);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2000);
    } catch {
      setError('No se pudo copiar. Selecciona el texto y cópialo a mano.');
    }
  }

  if (!url) {
    return (
      <div>
        <button
          type="button"
          onClick={generar}
          disabled={pending}
          className="text-sm px-3 py-1.5 rounded bg-azul text-white hover:bg-azul-oscuro cursor-pointer disabled:bg-lienzo disabled:text-tinta-suave/80"
        >
          {pending ? 'Generando…' : 'Conectar Telegram'}
        </button>
        {error && <div className="text-xs text-alerta mt-1">{error}</div>}
      </div>
    );
  }

  return (
    <div className="text-sm">
      <p className="mb-2">
        Se abrió Telegram en otra pestaña. Pulsa <b>Iniciar</b> en el chat del bot para terminar
        de conectar.
      </p>

      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        className="text-azul hover:underline break-all"
      >
        {url}
      </a>

      <details className="mt-4 bg-lienzo border border-borde rounded p-3">
        <summary className="text-xs font-semibold text-tinta cursor-pointer">
          ¿No se abrió Telegram o la página no carga?
        </summary>

        <div className="mt-3 space-y-2 text-xs text-tinta">
          <p>Puedes conectarte igual, a mano:</p>
          <ol className="list-decimal ml-4 space-y-1">
            <li>
              Abre Telegram y busca <b>@{bot}</b>
            </li>
            <li>Envíale este mensaje:</li>
          </ol>

          <div className="flex items-center gap-2 mt-1">
            <code className="flex-1 bg-tarjeta border border-borde rounded px-2 py-1.5 break-all font-mono text-[11px]">
              {comando}
            </code>
            <button
              type="button"
              onClick={copiar}
              className="text-xs px-2.5 py-1.5 rounded bg-negro-suave text-white hover:bg-negro cursor-pointer shrink-0"
            >
              {copiado ? '✓ Copiado' : 'Copiar'}
            </button>
          </div>
        </div>
      </details>

      <p className="text-xs text-tinta-suave/80 mt-3">
        El código vence en 15 minutos. Si no alcanzas, genera otro.
      </p>

      {error && <div className="text-xs text-alerta mt-1">{error}</div>}
    </div>
  );
}
