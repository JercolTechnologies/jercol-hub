'use client';

import { useState } from 'react';
import SignatureCapture from '@/components/SignatureCapture';

export default function SignContractForm({
  action,
  defaultName = '',
  heading = 'Firmar contrato',
  disclaimer,
}: {
  action: (formData: FormData) => void | Promise<void>;
  defaultName?: string;
  heading?: string;
  disclaimer: string;
}) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(defaultName);
  const [documentId, setDocumentId] = useState('');
  const [hasSignature, setHasSignature] = useState(false);
  const [accepted, setAccepted] = useState(false);

  const ready = name.trim() && documentId.trim() && hasSignature && accepted;

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="text-sm px-3 py-1.5 rounded bg-emerald-600 text-white hover:bg-emerald-700 cursor-pointer"
      >
        Firmar contrato
      </button>
    );
  }

  return (
    <form
      action={action}
      autoComplete="off"
      className="w-full border border-slate-200 rounded-lg p-4 bg-slate-50"
    >
      <h3 className="font-semibold text-sm mb-3">{heading}</h3>

      <div className="space-y-3">
        <div>
          <label className="block text-xs font-semibold text-slate-500 mb-1">Nombre completo</label>
          <input
            type="text"
            name="full_name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            autoComplete="off"
            className="w-full rounded border border-slate-300 px-3 py-2 text-sm"
            placeholder="Tal como aparece en el documento de identidad"
          />
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-500 mb-1">
            Documento de identidad (cédula o NIT)
          </label>
          <input
            type="text"
            name="document_id"
            value={documentId}
            onChange={(e) => setDocumentId(e.target.value)}
            autoComplete="off"
            className="w-full rounded border border-slate-300 px-3 py-2 text-sm"
          />
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-500 mb-1">Firma</label>
          <SignatureCapture typedNameDefault={name} onChange={setHasSignature} />
        </div>

        <label className="flex gap-2 text-xs text-slate-600 items-start">
          <input
            type="checkbox"
            checked={accepted}
            onChange={(e) => setAccepted(e.target.checked)}
            className="mt-0.5"
          />
          <span>{disclaimer}</span>
        </label>

        <div className="text-[11px] text-slate-400">
          Al firmar se registran la fecha, la hora, tu dirección IP y el dispositivo desde el que
          firmas, junto con una huella digital del documento.
        </div>
      </div>

      <div className="flex justify-end gap-2 mt-4">
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="text-sm px-3 py-1.5 rounded border border-slate-300 cursor-pointer"
        >
          Cancelar
        </button>
        <button
          type="submit"
          disabled={!ready}
          className="text-sm px-3 py-1.5 rounded bg-emerald-600 text-white hover:bg-emerald-700 cursor-pointer disabled:bg-slate-200 disabled:text-slate-400 disabled:cursor-not-allowed"
        >
          Firmar
        </button>
      </div>
    </form>
  );
}
