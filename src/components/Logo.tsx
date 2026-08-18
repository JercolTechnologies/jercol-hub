/**
 * Logo de Jercol Hub, redibujado en SVG a partir del original.
 *
 * En código y no como imagen por tres razones concretas: en una barra de
 * navegación un PNG se ve blando en pantallas de alta densidad, cuesta una
 * petición de red, y si su fondo no es exactamente el mismo negro de la barra
 * se le nota el borde. Además así las piezas heredan color por CSS, que hace
 * falta el día que se quiera una variante sobre fondo claro.
 *
 * El símbolo es un tablero de tres columnas con tarjetas y un check
 * superpuesto: proyectos organizados y trabajo aprobado, que es exactamente
 * lo que hace la aplicación.
 */

const AZUL = '#1668E3';
const VERDE = '#22D89C';
const GRIS = '#45494C';

/** Solo el símbolo, sin texto. Para la barra y para el favicon. */
export function LogoMark({ className = 'h-7 w-7' }: { className?: string }) {
  return (
    <svg viewBox="0 0 64 64" className={className} aria-hidden="true" fill="none">
      <defs>
        {/*
          El check se superpone a la esquina del tablero y en el original queda
          separado por un hueco. Ese hueco se hace con máscara y no rellenando
          un círculo del color del fondo: así el logo funciona igual sobre el
          negro de la barra, sobre el lienzo gris y sobre una tarjeta blanca,
          sin tener que decirle dónde está.

          El id es fijo a propósito. Si hubiera dos logos en la misma página
          compartirían máscara, que es idéntica en ambos, así que no cambia
          nada; generarlo por instancia obligaría a convertir esto en un
          componente de cliente.
        */}
        <mask id="jh-hueco-check">
          <rect width="64" height="64" fill="white" />
          <circle cx="47" cy="47" r="12.5" fill="black" />
        </mask>
      </defs>

      <g mask="url(#jh-hueco-check)">
        {/* Marco del tablero */}
        <rect
          x="4.5"
          y="8.5"
          width="47"
          height="39"
          rx="5"
          stroke="currentColor"
          strokeOpacity="0.45"
          strokeWidth="2.5"
        />

        {/* Separadores de columna */}
        <path
          d="M20.5 12v32M36.5 12v32"
          stroke="currentColor"
          strokeOpacity="0.35"
          strokeWidth="1.5"
          strokeLinecap="round"
        />

        {/* Encabezados de columna */}
        <path
          d="M8.5 14.5h8M24.5 14.5h8M40.5 14.5h8"
          stroke={VERDE}
          strokeWidth="2"
          strokeLinecap="round"
        />

        {/* Tarjetas: columna 1 */}
        <rect x="8" y="19" width="9" height="5.5" rx="2" fill={AZUL} />
        <rect x="8" y="27" width="9" height="5.5" rx="2" fill={AZUL} />
        <rect x="8" y="35" width="9" height="5.5" rx="2" fill={GRIS} />

        {/* Tarjetas: columna 2 */}
        <rect x="24" y="19" width="9" height="5.5" rx="2" fill={VERDE} />
        <rect x="24" y="27" width="9" height="5.5" rx="2" fill={GRIS} />

        {/* Tarjetas: columna 3 */}
        <rect x="40" y="19" width="9" height="5.5" rx="2" fill={AZUL} />
        <rect x="40" y="27" width="9" height="5.5" rx="2" fill={VERDE} />
        <rect x="40" y="35" width="9" height="5.5" rx="2" fill={GRIS} />
      </g>

      {/* Check: trabajo aprobado */}
      <circle cx="47" cy="47" r="8.5" stroke={VERDE} strokeWidth="2.5" />
      <path
        d="M43 47.2l2.8 2.8 5.2-5.6"
        stroke={VERDE}
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/**
 * Símbolo + nombre. `apilado` pone "Hub" debajo, como el logo original;
 * en línea es lo que cabe en una barra de navegación.
 */
export default function Logo({
  className = '',
  apilado = false,
  tamano = 'sm',
}: {
  className?: string;
  apilado?: boolean;
  tamano?: 'sm' | 'lg';
}) {
  const grande = tamano === 'lg';

  return (
    <span
      className={`inline-flex items-center ${grande ? 'gap-3' : 'gap-2'} ${className}`}
    >
      <LogoMark className={grande ? 'h-11 w-11' : 'h-7 w-7'} />
      <span
        className={`font-bold tracking-tight leading-none ${
          apilado ? 'flex flex-col gap-0.5' : 'flex items-baseline gap-1.5'
        } ${grande ? 'text-2xl' : 'text-base'}`}
      >
        <span>Jercol</span>
        <span className="text-verde">Hub</span>
      </span>
    </span>
  );
}
