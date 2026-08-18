import InfoTip from './InfoTip';

/**
 * Tarjeta con título. Es el bloque con el que se construyen las pantallas
 * internas: antes cada una repetía a mano el mismo `bg-tarjeta border rounded`
 * con márgenes distintos, y ninguna quedaba igual que la anterior.
 */
export default function Seccion({
  titulo,
  ayuda,
  descripcion,
  accion,
  className = '',
  children,
}: {
  titulo?: string;
  /** Texto del icono de ayuda junto al título. */
  ayuda?: string;
  descripcion?: string;
  /** Botón o enlace alineado a la derecha del título. */
  accion?: React.ReactNode;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <section className={`bg-tarjeta border border-borde rounded-xl p-5 sm:p-6 ${className}`}>
      {titulo && (
        <div className="flex items-start gap-3 mb-4">
          <div className="flex-1 min-w-0">
            <h2 className="text-sm font-semibold text-tinta flex items-center gap-1.5">
              {titulo}
              {ayuda && <InfoTip text={ayuda} />}
            </h2>
            {descripcion && (
              <p className="text-sm text-tinta-suave mt-1">{descripcion}</p>
            )}
          </div>
          {accion && <div className="shrink-0">{accion}</div>}
        </div>
      )}
      {children}
    </section>
  );
}
