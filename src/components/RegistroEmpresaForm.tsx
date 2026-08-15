'use client';

import { useState } from 'react';
import FileField from '@/components/FileField';
import type { ClientKind } from '@/lib/types';

/**
 * El formulario cambia según el tipo de cliente.
 *
 * A la persona natural nunca se le menciona el NIT: su documento fiscal es
 * la cédula, y preguntarle por un NIT que cree no tener solo genera dudas.
 * Internamente ambos casos guardan el mismo campo.
 */
export default function RegistroEmpresaForm({
  action,
}: {
  action: (formData: FormData) => void | Promise<void>;
}) {
  const [kind, setKind] = useState<ClientKind>('juridica');
  const [esRep, setEsRep] = useState(true);
  const [rutOk, setRutOk] = useState(false);
  const [cedulaOk, setCedulaOk] = useState(false);
  const [consent, setConsent] = useState(false);

  const juridica = kind === 'juridica';
  const listo = rutOk && cedulaOk && consent;

  return (
    <form action={action} className="space-y-5">
      <div>
        <label className="block text-xs font-semibold text-slate-500 mb-2">
          ¿Cómo contratas?
        </label>
        <div className="flex gap-2">
          {(
            [
              { v: 'juridica', l: 'Empresa' },
              { v: 'natural', l: 'Persona natural' },
            ] as const
          ).map((o) => (
            <button
              key={o.v}
              type="button"
              onClick={() => setKind(o.v)}
              className={`text-sm px-3 py-1.5 rounded cursor-pointer ${
                kind === o.v
                  ? 'bg-slate-800 text-white'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {o.l}
            </button>
          ))}
        </div>
        <input type="hidden" name="kind" value={kind} />
      </div>

      <div className="space-y-3">
        <div>
          <label className="block text-xs font-semibold text-slate-500 mb-1">
            {juridica ? 'Razón social' : 'Nombre completo'}
          </label>
          <input
            type="text"
            name="name"
            required
            className="w-full rounded border border-slate-300 px-3 py-2 text-sm"
            placeholder={juridica ? 'Politia Consulting SAS' : 'María Pérez Gómez'}
          />
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-500 mb-1">
            {juridica ? 'NIT' : 'Número de cédula'}
          </label>
          <input
            type="text"
            name="tax_id"
            required
            className="w-full rounded border border-slate-300 px-3 py-2 text-sm"
            placeholder={juridica ? '900123456-7' : '1020304050'}
          />
          <p className="text-[11px] text-slate-400 mt-1">
            Debe coincidir con el que aparece en el RUT.
          </p>
        </div>

        <div className="flex gap-2">
          <div className="flex-1">
            <label className="block text-xs font-semibold text-slate-500 mb-1">Ciudad</label>
            <input
              type="text"
              name="city"
              className="w-full rounded border border-slate-300 px-3 py-2 text-sm"
            />
          </div>
          <div className="flex-1">
            <label className="block text-xs font-semibold text-slate-500 mb-1">Teléfono</label>
            <input
              type="text"
              name="phone"
              className="w-full rounded border border-slate-300 px-3 py-2 text-sm"
              placeholder="573001234567"
            />
          </div>
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-500 mb-1">Dirección</label>
          <input
            type="text"
            name="address"
            className="w-full rounded border border-slate-300 px-3 py-2 text-sm"
          />
        </div>
      </div>

      {juridica && (
        <div className="border-t border-slate-100 pt-4 space-y-3">
          <div className="text-xs font-semibold text-slate-500">Representante legal</div>
          <p className="text-[11px] text-slate-400 -mt-2">
            Debe ser quien figura como representante en el RUT. Es quien podrá firmar contratos.
          </p>

          <div className="flex gap-2">
            <div className="flex-1">
              <label className="block text-xs font-semibold text-slate-500 mb-1">
                Nombre completo
              </label>
              <input
                type="text"
                name="rep_full_name"
                required
                className="w-full rounded border border-slate-300 px-3 py-2 text-sm"
              />
            </div>
            <div className="flex-1">
              <label className="block text-xs font-semibold text-slate-500 mb-1">Cédula</label>
              <input
                type="text"
                name="rep_document"
                required
                className="w-full rounded border border-slate-300 px-3 py-2 text-sm"
              />
            </div>
          </div>

          <div className="flex gap-2">
            <div className="flex-1">
              <label className="block text-xs font-semibold text-slate-500 mb-1">Teléfono</label>
              <input
                type="text"
                name="rep_phone"
                className="w-full rounded border border-slate-300 px-3 py-2 text-sm"
              />
            </div>
            <div className="flex-1">
              <label className="block text-xs font-semibold text-slate-500 mb-1">Correo</label>
              <input
                type="email"
                name="rep_email"
                className="w-full rounded border border-slate-300 px-3 py-2 text-sm"
              />
            </div>
          </div>

          <label className="flex items-start gap-2 text-xs text-slate-600">
            <input
              type="checkbox"
              name="registrant_is_rep"
              checked={esRep}
              onChange={(e) => setEsRep(e.target.checked)}
              className="mt-0.5"
            />
            <span>
              Soy yo quien está creando esta cuenta y declaro ser el representante legal de esta
              organización.
            </span>
          </label>

          {!esRep && (
            <div className="text-xs bg-amber-50 text-amber-800 rounded px-3 py-2">
              Sin problema. Para firmar contratos, el representante legal tendrá que crear su
              propia cuenta y unirse a esta organización, o presentar un poder.
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-slate-500 mb-1">Tu cargo</label>
            <input
              type="text"
              name="job_title"
              className="w-full rounded border border-slate-300 px-3 py-2 text-sm"
              placeholder="CEO, gerente, asistente…"
            />
          </div>
        </div>
      )}

      <div className="border-t border-slate-100 pt-4 space-y-3">
        <div className="text-xs font-semibold text-slate-500">Documentos</div>

        <div>
          <div className="text-xs text-slate-600 mb-1">RUT (obligatorio)</div>
          <FileField name="doc_rut" label="Adjuntar RUT" onSelect={setRutOk} />
        </div>

        <div>
          <div className="text-xs text-slate-600 mb-1">
            Cédula {juridica ? 'del representante legal' : ''} (obligatorio)
          </div>
          <FileField name="doc_cedula" label="Adjuntar cédula" onSelect={setCedulaOk} />
        </div>

        {juridica && (
          <div>
            <div className="text-xs text-slate-600 mb-1">
              Cámara de Comercio (opcional, pero acelera la verificación)
            </div>
            <FileField name="doc_camara" label="Adjuntar certificado" />
          </div>
        )}
      </div>

      <label className="flex items-start gap-2 text-xs text-slate-600 border-t border-slate-100 pt-4">
        <input
          type="checkbox"
          name="data_consent"
          checked={consent}
          onChange={(e) => setConsent(e.target.checked)}
          className="mt-0.5"
        />
        <span>
          Autorizo a Jercol Technologies a tratar los datos personales y documentos aquí
          aportados con la finalidad de verificar la identidad y la representación legal, y de
          respaldar los contratos que celebremos. Puedo solicitar su consulta, corrección o
          eliminación en cualquier momento.
        </span>
      </label>

      <button
        type="submit"
        disabled={!listo}
        className="w-full rounded bg-blue-600 text-white text-sm font-medium py-2 hover:bg-blue-700 cursor-pointer disabled:bg-slate-200 disabled:text-slate-400 disabled:cursor-not-allowed"
      >
        Enviar registro
      </button>

      {!listo && (
        <p className="text-[11px] text-slate-400 text-center -mt-2">
          Faltan los documentos obligatorios o la autorización.
        </p>
      )}
    </form>
  );
}
