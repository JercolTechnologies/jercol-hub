import type { Metadata } from 'next';
import { Analytics } from '@vercel/analytics/next';
import Footer from '@/components/Footer';
import './globals.css';

// Sin next/font a propósito: descarga la tipografía de Google en tiempo de
// build, y el entorno donde se verifica esta aplicación no tiene salida hacia
// ahí. Se prefiere la pila del sistema —excelente en Windows y Mac, cero
// descargas— antes que meter una dependencia de red que no se puede
// comprobar antes de desplegar. Si algún día se quiere Inter, va
// auto-hospedada en /public, que no depende de nada externo.

export const metadata: Metadata = {
  title: 'Jercol Hub',
  description: 'Proyectos, tareas, contratos y firmas. Todo en un lugar.',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es" className="h-full antialiased">
      <body className="min-h-full flex flex-col bg-lienzo text-tinta font-sans">
        {children}
        <Footer />
        <Analytics />
      </body>
    </html>
  );
}
