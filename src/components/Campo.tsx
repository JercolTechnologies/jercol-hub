/**
 * Piezas de formulario compartidas. Existen porque las mismas clases de
 * input y de botón estaban copiadas en una docena de archivos: cambiar el
 * radio de una esquina obligaba a buscar y reemplazar por todo el proyecto.
 */

export const claseInput =
  'w-full rounded-lg border border-borde bg-tarjeta px-3 py-2 text-sm ' +
  'placeholder:text-tinta-suave/60 ' +
  'focus:outline-none focus:border-azul focus:ring-2 focus:ring-azul/15 transition-colors';

export function Campo({
  etiqueta,
  ayuda,
  children,
}: {
  etiqueta: string;
  ayuda?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="block text-xs font-semibold text-tinta-suave mb-1.5">{etiqueta}</span>
      {children}
      {ayuda && <span className="block text-[11px] text-tinta-suave/80 mt-1">{ayuda}</span>}
    </label>
  );
}

/**
 * Botón. `principal` es la acción que la pantalla espera que hagas; solo
 * debería haber uno por vista.
 */
export function Boton({
  variante = 'principal',
  ancho = false,
  className = '',
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variante?: 'principal' | 'secundario' | 'peligro' | 'texto';
  ancho?: boolean;
}) {
  const base =
    'inline-flex items-center justify-center gap-2 rounded-lg text-sm font-medium ' +
    'transition-colors disabled:opacity-50 disabled:cursor-not-allowed ' +
    'focus:outline-none focus-visible:ring-2 focus-visible:ring-azul/40';

  const variantes = {
    principal: 'bg-azul text-white hover:bg-azul-oscuro px-4 py-2',
    secundario: 'border border-borde bg-tarjeta text-tinta hover:bg-lienzo px-4 py-2',
    peligro: 'border border-alerta/30 text-alerta hover:bg-alerta-fondo px-4 py-2',
    texto: 'text-azul hover:underline underline-offset-2 px-0 py-0',
  }[variante];

  return (
    <button
      {...props}
      className={`${base} ${variantes} ${ancho ? 'w-full' : ''} ${className}`}
    />
  );
}
