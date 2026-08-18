'use client';

import { useEffect, useRef } from 'react';

/**
 * Animación de marca de Jercol Technologies.
 *
 * Decisiones que conviene no deshacer sin motivo:
 *
 * - **Se reproduce una vez, no en bucle.** Dura diez segundos y comparte
 *   pantalla con un formulario. En bucle competiría con la persona que está
 *   escribiendo su correo.
 * - **Silenciada.** Los navegadores bloquean la reproducción automática con
 *   sonido, así que la pista de audio se quitó del archivo directamente.
 * - **`playsInline`** para que iOS no la abra a pantalla completa.
 * - **Póster con el último fotograma**, que es lo que se ve mientras carga y
 *   lo que queda cuando termina: así no hay ni negro al principio ni salto al
 *   final.
 * - Quien haya pedido menos movimiento en su sistema ve solo el póster.
 */
export default function IntroJercol({
  // Reemplaza, no se concatena: quien lo usa decide cómo encaja el vídeo, y
  // si se acumularan clases de tamaño (h-auto con h-full) el resultado
  // dependería del orden en la hoja de estilos, no del que escribe.
  className = 'w-full h-auto object-contain',
}: {
  className?: string;
}) {
  const ref = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const video = ref.current;
    if (!video) return;

    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      // El sistema pidió menos movimiento (en Windows: Accesibilidad →
      // Efectos visuales → Efectos de animación). Queda el póster.
      video.pause();
      console.info('IntroJercol: animación detenida por "reducir movimiento" del sistema.');
      return;
    }

    // No basta con el atributo `autoplay`: hay situaciones en que el navegador
    // lo ignora y no dice nada. Pedir la reproducción a mano devuelve una
    // promesa que, al fallar, explica el motivo — y sin esto el fallo era
    // indistinguible de que la animación ya hubiera terminado, porque el
    // póster es el último fotograma.
    video.muted = true;
    video.play().catch((e) => {
      console.warn('IntroJercol: el navegador no permitió reproducir:', e?.name, e?.message);
    });
  }, []);

  return (
    <video
      ref={ref}
      className={className}
      poster="/marca/intro-jercol.jpg"
      autoPlay
      muted
      playsInline
      preload="auto"
      aria-label="Animación del logotipo de Jercol Technologies"
    >
      {/* Como <source> y no como atributo src: así se declara el tipo MIME
          explícitamente y se descarta que el navegador esté descartando el
          archivo por no saber qué es. */}
      <source src="/marca/intro-jercol.mp4" type="video/mp4" />
    </video>
  );
}
