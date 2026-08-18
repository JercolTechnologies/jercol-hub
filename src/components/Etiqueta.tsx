/**
 * Etiqueta de estado. Los mismos cinco colores se repetían a mano en el
 * tablero, las ideas, los contratos y el panel de administración, cada uno con
 * su propia tabla de clases y sin coincidir entre sí.
 */
export type TonoEtiqueta = 'neutro' | 'azul' | 'verde' | 'ambar' | 'rojo';

const TONOS: Record<TonoEtiqueta, string> = {
  neutro: 'bg-lienzo text-tinta-suave border-borde',
  azul: 'bg-azul/10 text-azul border-azul/20',
  verde: 'bg-exito-fondo text-exito border-exito/20',
  ambar: 'bg-aviso-fondo text-aviso border-aviso/20',
  rojo: 'bg-alerta-fondo text-alerta border-alerta/20',
};

export default function Etiqueta({
  tono = 'neutro',
  children,
  className = '',
}: {
  tono?: TonoEtiqueta;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <span
      className={`inline-block text-[11px] leading-4 font-semibold px-1.5 py-0.5 rounded border whitespace-nowrap ${TONOS[tono]} ${className}`}
    >
      {children}
    </span>
  );
}
