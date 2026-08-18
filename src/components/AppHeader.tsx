'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import Logo from './Logo';

/**
 * Barra de navegación común. Antes cada página tenía su propio "volver", así
 * que ir de un contrato al inicio obligaba a encadenar varios clics.
 *
 * Es componente de cliente por dos razones concretas: marcar en qué sección
 * estás (necesita la ruta actual) y el menú de móvil. Con cinco enlaces más
 * "cerrar sesión", en un teléfono no cabía nada.
 */
export default function AppHeader({
  isAdmin,
  isOwner = false,
}: {
  isAdmin: boolean;
  /** Responsable de la cuenta de un cliente: solo él gestiona su equipo. */
  isOwner?: boolean;
}) {
  const [abierto, setAbierto] = useState(false);
  const pathname = usePathname();
  const home = isAdmin ? '/admin' : '/';

  const enlaces = [
    { href: home, texto: isAdmin ? 'Panel' : 'Mis proyectos' },
    { href: '/contratos', texto: 'Contratos' },
    { href: '/ideas', texto: 'Ideas' },
    ...(isOwner ? [{ href: '/equipo', texto: 'Equipo' }] : []),
    { href: '/perfil', texto: 'Perfil' },
  ];

  // La raíz solo cuenta como activa si es exactamente la raíz; si no,
  // cualquier ruta la marcaría.
  const activo = (href: string) =>
    href === '/' ? pathname === '/' : pathname.startsWith(href);

  const claseEnlace = (href: string) =>
    activo(href)
      ? 'text-white font-medium'
      : 'text-white/60 hover:text-white transition-colors';

  return (
    <header className="bg-negro text-white">
      <div className="max-w-5xl mx-auto w-full px-4">
        {/* Tres bloques: marca a la izquierda, navegación centrada, salir a la
            derecha. La navegación va en un contenedor que crece, así queda
            centrada respecto a la barra y no pegada al logo. */}
        <div className="flex items-center py-3">
          <Link
            href={home}
            className="shrink-0 hover:opacity-80 transition-opacity"
            aria-label="Ir al inicio"
          >
            <Logo />
          </Link>

          <nav className="hidden md:flex flex-1 items-center justify-center gap-7 text-sm">
            {enlaces.map((e) => (
              <Link key={e.href} href={e.href} className={claseEnlace(e.href)}>
                {e.texto}
              </Link>
            ))}
          </nav>

          <form action="/logout" method="post" className="hidden md:block shrink-0">
            <button className="text-sm text-white/60 hover:text-white transition-colors">
              Cerrar sesión
            </button>
          </form>

          <button
            type="button"
            onClick={() => setAbierto((v) => !v)}
            className="ml-auto md:hidden p-2 -mr-2 text-white/70 hover:text-white"
            aria-expanded={abierto}
            aria-label={abierto ? 'Cerrar menú' : 'Abrir menú'}
          >
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              {abierto ? (
                <path
                  d="M6 6l12 12M18 6L6 18"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                />
              ) : (
                <path
                  d="M4 7h16M4 12h16M4 17h16"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                />
              )}
            </svg>
          </button>
        </div>

        {abierto && (
          <nav className="md:hidden border-t border-white/10 py-2 flex flex-col">
            {enlaces.map((e) => (
              <Link
                key={e.href}
                href={e.href}
                onClick={() => setAbierto(false)}
                className={`py-2.5 text-sm ${claseEnlace(e.href)}`}
              >
                {e.texto}
              </Link>
            ))}
            <form action="/logout" method="post" className="py-2.5 border-t border-white/10 mt-1">
              <button className="text-sm text-white/60 hover:text-white">Cerrar sesión</button>
            </form>
          </nav>
        )}
      </div>
    </header>
  );
}
