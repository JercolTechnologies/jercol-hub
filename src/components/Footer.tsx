/** WhatsApp de Jercol Technologies, en formato internacional para wa.me. */
const WHATSAPP = 'https://wa.me/573019314319';

/**
 * Pie común. Va en el layout, así que sale en todas las pantallas.
 *
 * `mt-auto` con el `flex flex-col` del body lo empuja abajo aunque la página
 * tenga poco contenido, sin recurrir a alturas fijas.
 *
 * Sin el símbolo del logo a propósito: a 16 píxeles el tablero con sus ocho
 * tarjetas no se lee, se ve como una mancha. Un símbolo con ese detalle pide
 * 24 píxeles como mínimo, y aquí no hay sitio para eso.
 */
export default function Footer() {
  const anio = new Date().getFullYear();

  return (
    <footer className="mt-auto border-t border-borde bg-tarjeta">
      <div className="max-w-5xl mx-auto w-full px-4 py-5 text-xs text-tinta-suave text-center">
        © {anio} Jercol Hub. Todos los derechos reservados.
        <span className="hidden sm:inline"> | </span>
        <span className="block sm:inline mt-1 sm:mt-0">
          Desarrollado por{' '}
          <a
            href={WHATSAPP}
            target="_blank"
            rel="noopener noreferrer"
            className="font-medium text-tinta hover:text-azul underline-offset-2 hover:underline"
          >
            Jercol Technologies
          </a>
        </span>
      </div>
    </footer>
  );
}
