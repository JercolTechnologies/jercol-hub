import Logo from './Logo';
import IntroJercol from './IntroJercol';

/**
 * Marco común de las pantallas anteriores a tener sesión: entrar, crear
 * cuenta, recuperar contraseña.
 *
 * No llevan barra de navegación —no hay a dónde navegar todavía— pero sí la
 * marca desde el primer segundo.
 *
 * `conIntro` reserva la animación para crear cuenta. En "entrar", que se usa
 * a diario, diez segundos de animación cansan a la tercera vez.
 */
export default function AuthShell({
  titulo,
  descripcion,
  conIntro = false,
  ancho = 'sm',
  children,
}: {
  titulo: string;
  descripcion?: string;
  conIntro?: boolean;
  ancho?: 'sm' | 'lg';
  children: React.ReactNode;
}) {
  /**
   * Banda de marca: logo a la izquierda, animación a la derecha.
   *
   * Horizontal y no en columna lateral por una razón práctica: en columna, el
   * vídeo obligaba a que la tarjeta fuese muy alta y el formulario terminaba
   * por debajo del pliegue en un portátil. Como banda baja, todo cabe de una
   * vez.
   *
   * El vídeo va con `object-cover` porque la banda tiene una proporción
   * parecida a la suya y apenas recorta, y con una máscara que lo desvanece
   * hacia la izquierda para que se funda con el negro donde está el logo.
   * Arriba y abajo no hace falta desvanecer: ahí el vídeo llega justo al
   * borde de la tarjeta.
   */
  const banda = (
    <div className="relative bg-negro-video h-36 sm:h-44 overflow-hidden">
      <div
        className="absolute inset-y-0 right-0 w-3/5 sm:w-1/2"
        style={{
          maskImage: 'linear-gradient(to right, transparent 0%, #000 45%)',
          WebkitMaskImage: 'linear-gradient(to right, transparent 0%, #000 45%)',
        }}
      >
        <IntroJercol className="w-full h-full object-cover" />
      </div>

      <div className="relative h-full flex items-center px-6 sm:px-8">
        <Logo tamano="lg" className="text-white" />
      </div>
    </div>
  );

  return (
    // La puerta: fondo oscuro con la retícula de Jercol Technologies y la
    // tarjeta flotando encima. Es la zona donde se pasan segundos, no horas,
    // así que aquí sí manda la impresión sobre la lectura sostenida.
    <div className="reticula flex-1 flex items-center justify-center px-4 py-10">
      <div
        className={`w-full ${
          conIntro ? 'max-w-2xl' : ancho === 'lg' ? 'max-w-lg' : 'max-w-sm'
        }`}
      >
        <div className="bg-elevado border border-white/10 rounded-xl overflow-hidden shadow-2xl shadow-black/40">
          {conIntro && banda}

          <div className="p-6 sm:p-8">
            {!conIntro && (
              <div className="mb-6">
                <Logo tamano="lg" />
              </div>
            )}

            <h1 className="text-lg font-semibold mb-1">{titulo}</h1>
            {descripcion && <p className="text-sm text-tinta-suave mb-6">{descripcion}</p>}
            {!descripcion && <div className="mb-6" />}

            {children}
          </div>
        </div>

        <p className="mt-5 text-center text-[11px] font-mono tracking-wide text-verde/70">
          Proyectos · Tareas · Contratos · Firmas
        </p>
      </div>
    </div>
  );
}
