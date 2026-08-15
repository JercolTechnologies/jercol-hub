import 'server-only';

import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';

export interface SignatureRecord {
  rolLabel: string;
  fullName: string;
  documentId: string;
  signedAt: string;
  ip: string | null;
  userAgent: string | null;
  signatureImage: Uint8Array | null;
  signatureMime: string | null;
}

/**
 * pdf-lib solo puede escribir con las fuentes estándar, que usan la
 * codificación WinAnsi. Cualquier carácter fuera de ese conjunto (emoji,
 * comillas tipográficas, guiones largos según el origen) revienta el
 * render. Se limpia el texto antes de dibujarlo.
 */
function sanitize(text: string) {
  return text
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/[–—]/g, '-')
    .replace(/[^\x20-\x7E\xA0-\xFF]/g, '');
}

function fmt(iso: string) {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return (
    `${pad(d.getUTCDate())}/${pad(d.getUTCMonth() + 1)}/${d.getUTCFullYear()} ` +
    `${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())} UTC`
  );
}

/**
 * Toma el PDF original y le anexa una página de certificación con el
 * rastro digital de ambas firmas. El original no se modifica: se copia tal
 * cual y la página nueva va al final.
 */
export async function buildSignedPdf({
  originalPdf,
  contractTitle,
  clientName,
  documentSha256,
  signatures,
}: {
  originalPdf: Uint8Array;
  contractTitle: string;
  clientName: string;
  documentSha256: string;
  signatures: SignatureRecord[];
}): Promise<Uint8Array> {
  const pdf = await PDFDocument.load(originalPdf);
  const helv = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);

  const page = pdf.addPage();
  const { width, height } = page.getSize();
  const margin = 50;
  let y = height - margin;

  const ink = rgb(0.06, 0.09, 0.16);
  const muted = rgb(0.42, 0.45, 0.5);

  function line(text: string, size = 10, font = helv, color = ink) {
    page.drawText(sanitize(text), { x: margin, y, size, font, color });
    y -= size + 6;
  }

  function rule() {
    page.drawLine({
      start: { x: margin, y: y + 4 },
      end: { x: width - margin, y: y + 4 },
      thickness: 0.5,
      color: rgb(0.85, 0.87, 0.9),
    });
    y -= 10;
  }

  line('CERTIFICADO DE FIRMA ELECTRONICA', 16, bold);
  y -= 4;
  line('Jercol Technologies', 10, helv, muted);
  y -= 8;
  rule();

  line('Documento', 11, bold);
  line(`Titulo: ${contractTitle}`);
  line(`Cliente: ${clientName}`);
  line(`Huella SHA-256 del documento firmado:`);
  // El hash es largo: se parte en dos líneas para que quepa.
  line(`  ${documentSha256.slice(0, 32)}`, 9);
  line(`  ${documentSha256.slice(32)}`, 9);
  y -= 6;
  rule();

  for (const s of signatures) {
    line(s.rolLabel, 11, bold);
    line(`Nombre: ${s.fullName}`);
    line(`Documento de identidad: ${s.documentId}`);
    line(`Fecha y hora: ${fmt(s.signedAt)}`);
    line(`Direccion IP: ${s.ip || 'no registrada'}`);

    const ua = s.userAgent || 'no registrado';
    line(`Dispositivo: ${ua.slice(0, 80)}`, 8, helv, muted);
    if (ua.length > 80) line(`  ${ua.slice(80, 160)}`, 8, helv, muted);

    if (s.signatureImage && s.signatureImage.length) {
      try {
        const img =
          s.signatureMime === 'image/jpeg'
            ? await pdf.embedJpg(s.signatureImage)
            : await pdf.embedPng(s.signatureImage);
        const maxW = 180;
        const scale = Math.min(maxW / img.width, 60 / img.height, 1);
        const w = img.width * scale;
        const h = img.height * scale;
        y -= h;
        page.drawImage(img, { x: margin, y, width: w, height: h });
        page.drawLine({
          start: { x: margin, y: y - 3 },
          end: { x: margin + Math.max(w, 160), y: y - 3 },
          thickness: 0.5,
          color: rgb(0.6, 0.63, 0.68),
        });
        y -= 16;
      } catch {
        // Si la imagen viene corrupta se sigue: el valor probatorio está
        // en el rastro, no en el dibujo.
        line('(firma grafica no disponible)', 8, helv, muted);
      }
    }

    y -= 6;
    rule();
  }

  line(
    'Este certificado deja constancia de la manifestacion de voluntad de las partes',
    8,
    helv,
    muted
  );
  line(
    'por medios electronicos. La huella SHA-256 permite verificar que el documento',
    8,
    helv,
    muted
  );
  line('firmado no ha sido alterado con posterioridad.', 8, helv, muted);

  return pdf.save();
}
