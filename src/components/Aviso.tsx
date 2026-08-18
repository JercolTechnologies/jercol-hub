/**
 * Mensaje de estado. Un solo componente para toda la aplicación, porque hasta
 * ahora cada pantalla pintaba su propio recuadro rojo o verde con clases
 * distintas, y unas acciones confirmaban y otras no decían nada.
 *
 * Los cuatro tonos usan los colores declarados en globals.css, no verdes y
 * rojos sueltos elegidos a ojo en cada archivo.
 */
export default function Aviso({
  tipo = 'error',
  children,
  className = '',
}: {
  tipo?: 'error' | 'exito' | 'aviso' | 'info';
  children: React.ReactNode;
  className?: string;
}) {
  if (!children) return null;

  const estilos = {
    error: 'text-alerta bg-alerta-fondo border-alerta/20',
    exito: 'text-exito bg-exito-fondo border-exito/20',
    aviso: 'text-aviso bg-aviso-fondo border-aviso/20',
    info: 'text-tinta-suave bg-lienzo border-borde',
  }[tipo];

  return (
    <div
      className={`text-sm rounded-lg border px-3 py-2.5 ${estilos} ${className}`}
      role={tipo === 'error' ? 'alert' : 'status'}
    >
      {children}
    </div>
  );
}
