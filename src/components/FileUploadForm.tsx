'use client';

import { useState } from 'react';
import FileField from '@/components/FileField';

/**
 * Formulario de subida de un archivo. Recibe la Server Action como prop.
 * El botón de envío queda desactivado hasta que haya archivo elegido, que es
 * la forma de exigir el archivo sin usar `required` en un input oculto.
 */
export default function FileUploadForm({
  action,
  accept,
  fileLabel = 'Elegir archivo',
  submitLabel = 'Subir',
  withNotes = false,
  notesPlaceholder = 'Nota (opcional)',
}: {
  action: (formData: FormData) => void | Promise<void>;
  accept?: string;
  fileLabel?: string;
  submitLabel?: string;
  withNotes?: boolean;
  notesPlaceholder?: string;
}) {
  const [hasFile, setHasFile] = useState(false);

  return (
    <form action={action} className="space-y-2">
      <FileField name="file" accept={accept} label={fileLabel} onSelect={setHasFile} />
      <div className="flex gap-2">
        {withNotes && (
          <input
            type="text"
            name="notes"
            placeholder={notesPlaceholder}
            className="flex-1 rounded border border-borde px-2 py-1.5 text-sm"
          />
        )}
        <button
          type="submit"
          disabled={!hasFile}
          className="text-sm px-3 py-1.5 rounded bg-azul text-white hover:bg-azul-oscuro cursor-pointer disabled:bg-lienzo disabled:text-tinta-suave/80 disabled:cursor-not-allowed"
        >
          {submitLabel}
        </button>
      </div>
    </form>
  );
}
