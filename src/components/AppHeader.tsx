import Link from 'next/link';

/**
 * Barra de navegación común. Antes cada página tenía su propio "volver",
 * así que ir de un contrato al inicio obligaba a encadenar varios clics.
 *
 * El nombre de la marca hará de enlace al inicio también cuando exista el
 * logo definitivo.
 */
export default function AppHeader({
  isAdmin,
  isOwner = false,
}: {
  isAdmin: boolean;
  /** Responsable de la cuenta de un cliente: solo él gestiona su equipo. */
  isOwner?: boolean;
}) {
  const home = isAdmin ? '/admin' : '/';

  return (
    <header className="bg-white border-b border-slate-200">
      <div className="max-w-5xl mx-auto w-full px-4 py-3 flex items-center gap-5">
        <Link href={home} className="font-semibold text-sm shrink-0">
          Jercol Hub
        </Link>

        <nav className="flex items-center gap-4 text-sm text-slate-500">
          <Link href={home} className="hover:text-slate-900">
            {isAdmin ? 'Panel' : 'Mis proyectos'}
          </Link>
          <Link href="/contratos" className="hover:text-slate-900">
            Contratos
          </Link>
          <Link href="/ideas" className="hover:text-slate-900">
            Ideas
          </Link>
          {isOwner && (
            <Link href="/equipo" className="hover:text-slate-900">
              Equipo
            </Link>
          )}
          <Link href="/perfil" className="hover:text-slate-900">
            Perfil
          </Link>
        </nav>

        <form action="/logout" method="post" className="ml-auto">
          <button className="text-sm text-slate-500 hover:underline cursor-pointer" type="submit">
            Cerrar sesión
          </button>
        </form>
      </div>
    </header>
  );
}
