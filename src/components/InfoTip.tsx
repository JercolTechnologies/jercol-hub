'use client';

import { useEffect, useRef, useState } from 'react';

/**
 * Ícono de ayuda que abre un texto explicativo al hacer click/tap.
 * A propósito NO usa hover: en móvil no existe, así que un solo
 * mecanismo (click/tap) que funciona igual en todos los dispositivos.
 */
export default function InfoTip({ text }: { text: string }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (!open) return;
    function onClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('click', onClickOutside);
    return () => document.removeEventListener('click', onClickOutside);
  }, [open]);

  return (
    <span className="relative inline-block" ref={ref}>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          setOpen((v) => !v);
        }}
        className="w-4 h-4 rounded-full bg-slate-200 text-slate-600 text-[10px] font-bold leading-4 text-center hover:bg-slate-300"
        aria-label="Ayuda"
      >
        i
      </button>
      {open && (
        <div className="absolute z-50 top-5 left-0 w-56 bg-slate-800 text-white text-xs rounded-md px-3 py-2 shadow-lg">
          {text}
        </div>
      )}
    </span>
  );
}
