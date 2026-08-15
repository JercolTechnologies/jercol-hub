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

  // ------------------------------------------------------------------
  // Hoja 1: las firmas.
  //
  // Va en página propia y no estampada al pie del documento original a
  // propósito: no hay forma de saber qué contenido hay en la última página
  // y las imágenes podrían solaparse con el bloque de firmas del contrato.
  // La validez no depende de la posición, sino del consentimiento y del
  // rastro de la hoja siguiente.
  // ------------------------------------------------------------------
  const sigPage = pdf.addPage();
  {
    const { height: sh } = sigPage.getSize();
    const m = 50;
    let sy = sh - m;

    sigPage.drawText(sanitize('FIRMAS'), {
      x: m,
      y: sy,
      size: 16,
      font: bold,
      color: rgb(0.06, 0.09, 0.16),
    });
    sy -= 24;

    sigPage.drawText(sanitize(contractTitle), {
      x: m,
      y: sy,
      size: 11,
      font: helv,
      color: rgb(0.42, 0.45, 0.5),
    });
    sy -= 40;

    for (const s of signatures) {
      // Imagen de la firma sobre la línea.
      if (s.signatureImage && s.signatureImage.length) {
        try {
          const img =
            s.signatureMime === 'image/jpeg'
              ? await pdf.embedJpg(s.signatureImage)
              : await pdf.embedPng(s.signatureImage);
          const scale = Math.min(200 / img.width, 55 / img.height, 1);
          const w = img.width * scale;
          const h = img.height * scale;
          sigPage.drawImage(img, { x: m, y: sy - h, width: w, height: h });
          sy -= h;
        } catch {
          sy -= 20;
        }
      } else {
        sy -= 20;
      }

      // Línea de firma
      sigPage.drawLine({
        start: { x: m, y: sy - 4 },
        end: { x: m + 240, y: sy - 4 },
        thickness: 0.8,
        color: rgb(0.2, 0.23, 0.28),
      });
      sy -= 18;

      const put = (t: string, size = 10, font = helv, color = rgb(0.06, 0.09, 0.16)) => {
        sigPage.drawText(sanitize(t), { x: m, y: sy, size, font, color });
        sy -= size + 5;
      };

      put(s.fullName, 11, bold);
      const quien = s.rolLabel.replace('Firma de ', '').replace('Firma del ', '');
      put(quien.charAt(0).toUpperCase() + quien.slice(1), 9, helv, rgb(0.42, 0.45, 0.5));
      put(`Documento: ${s.documentId}`, 9);
      put(`Fecha: ${fmt(s.signedAt)}`, 9, helv, rgb(0.42, 0.45, 0.5));

      sy -= 34;
      if (sy < 140) break; // no cabe otra firma: el detalle queda en la hoja de certificación
    }

    sigPage.drawText(
      sanitize('El detalle de verificacion de estas firmas consta en la pagina siguiente.'),
      { x: m, y: m, size: 8, font: helv, color: rgb(0.42, 0.45, 0.5) }
    );
  }

  // ------------------------------------------------------------------
  // Hoja 2: certificado con el rastro digital.
  // ------------------------------------------------------------------
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
