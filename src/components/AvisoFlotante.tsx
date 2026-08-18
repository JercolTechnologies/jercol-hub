'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Sustituye a `alert()` del navegador.
 *
 * `alert` tiene tres problemas que no se ven hasta que alguien lo usa de
 * verdad: bloquea la página entera hasta que se acepta, no se puede leer
 * junto a lo que estabas haciendo, y aparece con el estilo del sistema
 * operativo, que no se parece en nada al resto de la aplicación. Para un
 * error de "no se pudo subir el archivo" es una interrupción desmedida.
 *
 * Uso:
 *   const { mensaje, mostrar, limpiar } = useMensaje();
 *   ...
 *   if (error) mostrar('No se pudo guardar: ' + error.message);
 *   ...
 *   <AvisoFlotante mensaje={mensaje} onCerrar={limpiar} />
 */

export type MensajeFlotante = { texto: string; tipo: 'error' | 'exito' } | null;

export function useMensaje() {
  const [mensaje, setMensaje] = useState<MensajeFlotante>(null);

  const mostrar = useCallback((texto: string, tipo: 'error' | 'exito' = 'error') => {
    setMensaje({ texto, tipo });
  }, []);

  const limpiar = useCallback(() => setMensaje(null), []);

  return { mensaje, mostrar, limpiar };
}

export default function AvisoFlotante({
  mensaje,
  onCerrar,
}: {
  mensaje: MensajeFlotante;
  onCerrar: () => void;
}) {
  const temporizador = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    // Los errores se quedan hasta que se cierran: si desaparecen solos, la
    // persona se queda sin saber qué falló. Las confirmaciones sí se van.
    if (mensaje?.tipo !== 'exito') return;

    temporizador.current = setTimeout(onCerrar, 4000);
    return () => {
      if (temporizador.current) clearTimeout(temporizador.current);
    };
  }, [mensaje, onCerrar]);

  if (!mensaje) return null;

  const esError = mensaje.tipo === 'error';

  return (
    <div
      role={esError ? 'alert' : 'status'}
      className={`fixed z-50 bottom-4 left-4 right-4 sm:left-auto sm:right-6 sm:max-w-sm
        rounded-lg border shadow-lg px-4 py-3 text-sm flex items-start gap-3
        animate-[aviso-entra_0.2s_ease-out]
        ${
          esError
            ? 'bg-alerta-fondo border-alerta/25 text-alerta'
            : 'bg-exito-fondo border-exito/25 text-exito'
        }`}
    >
      <span className="flex-1">{mensaje.texto}</span>
      <button
        type="button"
        onClick={onCerrar}
        className="shrink-0 opacity-60 hover:opacity-100 -mr-1 -mt-0.5 text-lg leading-none"
        aria-label="Cerrar aviso"
      >
        ×
      </button>
    </div>
  );
}
