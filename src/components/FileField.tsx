'use client';

import { useState } from 'react';

/**
 * Reemplaza el control nativo de archivo, que en el navegador se ve como
 * "Seleccionar archivo · Ningún archivo seleccionado" sin parecer un botón.
 *
 * Nota: el input no lleva `required`. Un input oculto con `required` hace que
 * el navegador intente enfocar algo invisible y bloquee el envío del
 * formulario sin explicar por qué. La obligatoriedad se controla desactivando
 * el botón de envío (ver FileUploadForm) y validando en el servidor.
 */
export default function FileField({
  name,
  accept,
  label = 'Elegir archivo',
  onSelect,
}: {
  name: string;
  accept?: string;
  label?: string;
  onSelect?: (hasFile: boolean) => void;
}) {
  const [fileName, setFileName] = useState('');

  return (
    <div className="flex items-center gap-2">
      <label className="text-sm px-3 py-1.5 rounded border border-borde hover:bg-tarjeta cursor-pointer shrink-0">
        {label}
        <input
          type="file"
          name={name}
          accept={accept}
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            setFileName(f?.name || '');
            onSelect?.(!!f);
          }}
        />
      </label>
      <span className={`text-xs truncate ${fileName ? 'text-tinta' : 'text-tinta-suave/80'}`}>
        {fileName || 'Ningún archivo elegido'}
      </span>
    </div>
  );
}
