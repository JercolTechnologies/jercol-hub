'use client';

import { useRef, useState } from 'react';
import AvisoFlotante, { useMensaje } from '@/components/AvisoFlotante';

type Mode = 'subir' | 'dibujar' | 'escribir';

const CANVAS_W = 460;
const CANVAS_H = 150;

/**
 * Captura la firma de tres formas y entrega siempre lo mismo: un PNG en
 * data URL, dentro de un input oculto para que viaje con el formulario.
 */
export default function SignatureCapture({
  name = 'signature_data',
  typedNameDefault = '',
  onChange,
}: {
  name?: string;
  typedNameDefault?: string;
  onChange?: (hasSignature: boolean) => void;
}) {
  const { mensaje, mostrar, limpiar } = useMensaje();
  const [mode, setMode] = useState<Mode>('dibujar');
  const [dataUrl, setDataUrl] = useState('');
  const [typed, setTyped] = useState(typedNameDefault);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);
  const hasDrawn = useRef(false);

  function update(value: string) {
    setDataUrl(value);
    onChange?.(!!value);
  }

  // ---------- Dibujar ----------
  function getCtx() {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = '#0f172a';
    return ctx;
  }

  function pos(e: React.PointerEvent<HTMLCanvasElement>) {
    const rect = e.currentTarget.getBoundingClientRect();
    return {
      x: ((e.clientX - rect.left) / rect.width) * CANVAS_W,
      y: ((e.clientY - rect.top) / rect.height) * CANVAS_H,
    };
  }

  function startDraw(e: React.PointerEvent<HTMLCanvasElement>) {
    const ctx = getCtx();
    if (!ctx) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    drawing.current = true;
    hasDrawn.current = true;
    const p = pos(e);
    ctx.beginPath();
    ctx.moveTo(p.x, p.y);
  }

  function moveDraw(e: React.PointerEvent<HTMLCanvasElement>) {
    if (!drawing.current) return;
    const ctx = getCtx();
    if (!ctx) return;
    const p = pos(e);
    ctx.lineTo(p.x, p.y);
    ctx.stroke();
  }

  function endDraw() {
    if (!drawing.current) return;
    drawing.current = false;
    const canvas = canvasRef.current;
    if (canvas && hasDrawn.current) update(canvas.toDataURL('image/png'));
  }

  function clearCanvas() {
    const canvas = canvasRef.current;
    const ctx = getCtx();
    if (!canvas || !ctx) return;
    ctx.clearRect(0, 0, CANVAS_W, CANVAS_H);
    hasDrawn.current = false;
    update('');
  }

  // ---------- Escribir (genera la firma a partir del nombre) ----------
  // Se genera en el propio manejador del input: es la reacción directa a una
  // acción del usuario, no una sincronización con un sistema externo.
  function renderTyped(value: string) {
    setTyped(value);
    if (!value.trim()) {
      update('');
      return;
    }
    const canvas = document.createElement('canvas');
    canvas.width = CANVAS_W;
    canvas.height = CANVAS_H;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.fillStyle = '#0f172a';
    ctx.font = 'italic 46px "Segoe Script", "Brush Script MT", cursive';
    ctx.textBaseline = 'middle';
    ctx.fillText(value.trim(), 20, CANVAS_H / 2, CANVAS_W - 40);
    update(canvas.toDataURL('image/png'));
  }

  // ---------- Subir imagen ----------
  function handleFile(file: File | undefined) {
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      mostrar('La firma debe ser una imagen (PNG o JPG).');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => update(String(reader.result || ''));
    reader.readAsDataURL(file);
  }

  function switchMode(m: Mode) {
    setMode(m);
    hasDrawn.current = false;
    const ctx = getCtx();
    if (ctx) ctx.clearRect(0, 0, CANVAS_W, CANVAS_H);

    // Al pasar a "generar del nombre" con un nombre ya escrito, se dibuja de
    // una vez en vez de esperar a que el usuario toque el campo.
    if (m === 'escribir' && typed.trim()) renderTyped(typed);
    else update('');
  }

  const tabs: { key: Mode; label: string }[] = [
    { key: 'dibujar', label: 'Dibujar' },
    { key: 'subir', label: 'Subir imagen' },
    { key: 'escribir', label: 'Generar del nombre' },
  ];

  return (
    <div>
      <input type="hidden" name={name} value={dataUrl} />

      <div className="flex gap-1 mb-2">
        {tabs.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => switchMode(t.key)}
            className={`text-xs px-2.5 py-1 rounded cursor-pointer ${
              mode === t.key
                ? 'bg-negro-suave text-white'
                : 'bg-elevado border border-borde text-tinta hover:bg-tarjeta'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {mode === 'dibujar' && (
        <div>
          <canvas
            ref={canvasRef}
            width={CANVAS_W}
            height={CANVAS_H}
            onPointerDown={startDraw}
            onPointerMove={moveDraw}
            onPointerUp={endDraw}
            onPointerLeave={endDraw}
            className="w-full border border-borde rounded bg-campo touch-none cursor-crosshair"
          />
          <button
            type="button"
            onClick={clearCanvas}
            className="text-xs text-tinta-suave hover:underline mt-1 cursor-pointer"
          >
            Limpiar
          </button>
        </div>
      )}

      {mode === 'subir' && (
        <div>
          <label className="text-sm px-3 py-1.5 rounded border border-borde hover:bg-tarjeta cursor-pointer inline-block">
            Elegir imagen de firma
            <input
              type="file"
              accept="image/png,image/jpeg"
              className="hidden"
              onChange={(e) => handleFile(e.target.files?.[0])}
            />
          </label>
          {dataUrl && (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img
              src={dataUrl}
              alt="Firma"
              className="mt-2 max-h-24 border border-borde rounded bg-campo"
            />
          )}
        </div>
      )}

      {mode === 'escribir' && (
        <div>
          <input
            type="text"
            value={typed}
            onChange={(e) => renderTyped(e.target.value)}
            placeholder="Escribe tu nombre completo"
            className="w-full rounded-lg border border-borde bg-campo px-3 py-2 text-sm"
          />
          {dataUrl && (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img
              src={dataUrl}
              alt="Firma generada"
              className="mt-2 max-h-24 border border-borde rounded bg-campo"
            />
          )}
        </div>
      )}

      <AvisoFlotante mensaje={mensaje} onCerrar={limpiar} />
    </div>
  );
}
