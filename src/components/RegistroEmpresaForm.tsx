'use client';

import { useState } from 'react';
import Aviso from '@/components/Aviso';
import FileField from '@/components/FileField';
import { Boton, claseInput } from '@/components/Campo';
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
  const [cedulaRevOk, setCedulaRevOk] = useState(false);
  const [consent, setConsent] = useState(false);

  const juridica = kind === 'juridica';
  const listo = rutOk && cedulaOk && cedulaRevOk && consent;

  return (
    <form action={action} className="space-y-5">
      <div>
        <label className="block text-xs font-semibold text-tinta-suave mb-2">
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
              className={`text-sm px-3.5 py-1.5 rounded-lg border transition-colors ${
                kind === o.v
                  ? 'bg-azul text-white border-azul'
                  : 'bg-tarjeta text-tinta-suave border-borde hover:border-azul/60'
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
          <label className="block text-xs font-semibold text-tinta-suave mb-1.5">
            {juridica ? 'Razón social' : 'Nombre completo'}
          </label>
          <input
            type="text"
            name="name"
            required
            className={claseInput}
            placeholder={juridica ? 'Politia Consulting SAS' : 'María Pérez Gómez'}
          />
        </div>

        <div>
          <label className="block text-xs font-semibold text-tinta-suave mb-1.5">NIT</label>
          <input
            type="text"
            name="tax_id"
            required
            className={claseInput}
            placeholder={juridica ? '900123456-7' : '50938826-5'}
          />
          <p className="text-[11px] text-tinta-suave/80 mt-1">
            {juridica
              ? 'Lo encuentras en tu RUT: casilla 5 (NIT) y casilla 6 (DV).'
              : 'Tu NIT es tu número de cédula seguido del dígito de verificación. Si no estás seguro, míralo en tu RUT: casilla 5 (NIT) y casilla 6 (DV).'}
          </p>
        </div>

        <div className="flex gap-2">
          <div className="flex-1">
            <label className="block text-xs font-semibold text-tinta-suave mb-1.5">Ciudad</label>
            <input
              type="text"
              name="city"
              className={claseInput}
            />
          </div>
          <div className="flex-1">
            <label className="block text-xs font-semibold text-tinta-suave mb-1.5">Teléfono</label>
            <input
              type="text"
              name="phone"
              className={claseInput}
              placeholder="573001234567"
            />
          </div>
        </div>

        <div>
          <label className="block text-xs font-semibold text-tinta-suave mb-1.5">Dirección</label>
          <input
            type="text"
            name="address"
            className={claseInput}
          />
        </div>
      </div>

      {juridica && (
        <div className="border-t border-borde pt-4 space-y-3">
          <div className="text-xs font-semibold text-tinta-suave">Representante legal</div>
          <p className="text-[11px] text-tinta-suave/80 -mt-2">
            Debe ser quien figura como representante en el RUT. Es quien podrá firmar contratos.
          </p>

          <div className="flex gap-2">
            <div className="flex-1">
              <label className="block text-xs font-semibold text-tinta-suave mb-1.5">
                Nombre completo
              </label>
              <input
                type="text"
                name="rep_full_name"
                required
                className={claseInput}
              />
            </div>
            <div className="flex-1">
              <label className="block text-xs font-semibold text-tinta-suave mb-1.5">Cédula</label>
              <input
                type="text"
                name="rep_document"
                required
                className={claseInput}
              />
            </div>
          </div>

          <div className="flex gap-2">
            <div className="flex-1">
              <label className="block text-xs font-semibold text-tinta-suave mb-1.5">Teléfono</label>
              <input
                type="text"
                name="rep_phone"
                className={claseInput}
              />
            </div>
            <div className="flex-1">
              <label className="block text-xs font-semibold text-tinta-suave mb-1.5">Correo</label>
              <input
                type="email"
                name="rep_email"
                className={claseInput}
              />
            </div>
          </div>

          <label className="flex items-start gap-2 text-xs text-tinta cursor-pointer">
            <input
              type="checkbox"
              name="registrant_is_rep"
              checked={esRep}
              onChange={(e) => setEsRep(e.target.checked)}
              className="mt-0.5 accent-azul cursor-pointer"
            />
            <span>
              Soy yo quien está creando esta cuenta y declaro ser el representante legal de esta
              organización.
            </span>
          </label>

          {!esRep && (
            <Aviso tipo="aviso" className="text-xs">
              Sin problema. Para firmar contratos, el representante legal tendrá que crear su
              propia cuenta y unirse a esta organización, o presentar un poder.
            </Aviso>
          )}

          <div>
            <label className="block text-xs font-semibold text-tinta-suave mb-1.5">Tu cargo</label>
            <input
              type="text"
              name="job_title"
              className={claseInput}
              placeholder="CEO, gerente, asistente…"
            />
          </div>
        </div>
      )}

      <div className="border-t border-borde pt-4 space-y-3">
        <div className="text-xs font-semibold text-tinta-suave">Documentos</div>

        <div>
          <div className="text-xs text-tinta mb-1.5">RUT (obligatorio)</div>
          <FileField name="doc_rut" label="Adjuntar RUT" onSelect={setRutOk} />
        </div>

        <div>
          <div className="text-xs text-tinta mb-1.5">
            Cédula {juridica ? 'del representante legal' : ''} — ambas caras (obligatorio)
          </div>
          <div className="space-y-2">
            <FileField name="doc_cedula" label="Cara frontal" onSelect={setCedulaOk} />
            <FileField name="doc_cedula_reverso" label="Reverso" onSelect={setCedulaRevOk} />
          </div>
        </div>

        {juridica && (
          <div>
            <div className="text-xs text-tinta mb-1.5">
              Cámara de Comercio (opcional, pero acelera la verificación)
            </div>
            <FileField name="doc_camara" label="Adjuntar certificado" />
          </div>
        )}
      </div>

      <label className="flex items-start gap-2 text-xs text-tinta border-t border-borde pt-4 cursor-pointer">
        <input
          type="checkbox"
          name="data_consent"
          checked={consent}
          onChange={(e) => setConsent(e.target.checked)}
          className="mt-0.5 accent-azul cursor-pointer"
        />
        <span>
          Autorizo a Jercol Technologies a tratar los datos personales y documentos aquí
          aportados con la finalidad de verificar la identidad y la representación legal, y de
          respaldar los contratos que celebremos. Puedo solicitar su consulta, corrección o
          eliminación en cualquier momento.
        </span>
      </label>

      <Boton type="submit" ancho disabled={!listo}>
        Enviar registro
      </Boton>

      {!listo && (
        <p className="text-[11px] text-tinta-suave text-center -mt-2">
          Faltan los documentos obligatorios o la autorización.
        </p>
      )}
    </form>
  );
}
