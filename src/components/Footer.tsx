'use client';

import { usePathname } from 'next/navigation';

/** WhatsApp de Jercol Technologies, en formato internacional para wa.me. */
const WHATSAPP = 'https://wa.me/573019314319';

/** Rutas de "la puerta": fondo oscuro, así que el pie va oscuro también. */
const RUTAS_PUERTA = ['/login', '/signup', '/recuperar'];

/**
 * Pie común. Va en el layout, así que sale en todas las pantallas.
 *
 * Es componente de cliente solo para saber en qué zona está: con el pie claro
 * fijo, en las pantallas de entrada quedaba una franja gris cortando el fondo
 * negro. La alternativa era separar las rutas de entrada en su propio layout,
 * que obliga a reorganizar carpetas para resolver una diferencia de color.
 *
 * Sin el símbolo del logo a propósito: a 16 píxeles el tablero con sus ocho
 * tarjetas no se lee, se ve como una mancha.
 */
export default function Footer() {
  const pathname = usePathname();
  const anio = new Date().getFullYear();
  const oscuro = RUTAS_PUERTA.some((r) => pathname.startsWith(r));

  return (
    <footer
      className={
        oscuro
          ? 'mt-auto border-t border-white/10 bg-negro'
          : 'mt-auto border-t border-borde bg-tarjeta'
      }
    >
      <div
        className={`max-w-5xl mx-auto w-full px-4 py-5 text-xs text-center ${
          oscuro ? 'text-white/45' : 'text-tinta-suave'
        }`}
      >
        © {anio} Jercol Hub. Todos los derechos reservados.
        <span className="hidden sm:inline"> | </span>
        <span className="block sm:inline mt-1 sm:mt-0">
          Desarrollado por{' '}
          <a
            href={WHATSAPP}
            target="_blank"
            rel="noopener noreferrer"
            className={`font-medium underline-offset-2 hover:underline ${
              oscuro ? 'text-verde hover:text-verde' : 'text-tinta hover:text-azul'
            }`}
          >
            Jercol Technologies
          </a>
        </span>
      </div>
    </footer>
  );
}
