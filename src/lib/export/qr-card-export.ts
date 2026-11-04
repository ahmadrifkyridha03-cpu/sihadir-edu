import { jsPDF } from 'jspdf';
import QRCode from 'qrcode';
import { generateSignedQrToken } from '@/lib/qr-token';
import { getSchoolProfile } from './school-config';

export interface StudentCardData {
  id: string;
  nis: string;
  nisn: string;
  fullName: string;
  className: string;
  qrToken?: string | null;
  photoUrl?: string | null;
  academicYear?: string;
}

export interface QrCardExportOptions {
  layout?: '10_CARDS' | '8_CARDS'; // 10 cards (2x5) or 8 cards (2x4)
  showCropMarks?: boolean;
}

// CR80 Standard dimensions in millimeters
const CARD_WIDTH = 85.6;
const CARD_HEIGHT = 53.98;

/**
 * Generates print-ready A4 PDF containing CR80 standard student identity cards with signed QR codes.
 */
export async function generateCr80QrCardsPdf(
  students: StudentCardData[],
  options: QrCardExportOptions = {}
): Promise<Buffer> {
  const school = getSchoolProfile();
  const layout = options.layout || '10_CARDS';
  const showCropMarks = options.showCropMarks !== false;

  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const cardsPerPage = layout === '10_CARDS' ? 10 : 8;
  const numCols = 2;
  const numRows = layout === '10_CARDS' ? 5 : 4;

  // Geometry configuration
  let marginLeft: number;
  let marginTop: number;
  let colGap: number;
  let rowGap: number;

  if (layout === '10_CARDS') {
    // 2x5 grid on A4 (210 x 297 mm)
    marginLeft = 14.4;
    marginTop = 9.55;
    colGap = 10.0;
    rowGap = 2.0;
  } else {
    // 2x4 grid on A4 (210 x 297 mm) for printers with wide unprintable margins
    marginLeft = 14.4;
    marginTop = 18.0;
    colGap = 10.0;
    rowGap = 15.0;
  }

  // Pre-generate QR code data URLs for all students
  const qrDataUrls: string[] = [];
  for (const student of students) {
    const rawId = student.nis || student.id;
    const token = student.qrToken || generateSignedQrToken(rawId);
    const dataUrl = await QRCode.toDataURL(token, {
      errorCorrectionLevel: 'M',
      margin: 1,
      width: 256,
      color: {
        dark: '#000000',
        light: '#FFFFFF',
      },
    });
    qrDataUrls.push(dataUrl);
  }

  let currentPage = 1;
  const totalStudents = students.length;

  for (let i = 0; i < totalStudents; i++) {
    const student = students[i];
    const qrDataUrl = qrDataUrls[i];
    const indexOnPage = i % cardsPerPage;

    if (i > 0 && indexOnPage === 0) {
      doc.addPage('a4', 'portrait');
      currentPage++;
    }

    const colIdx = indexOnPage % numCols;
    const rowIdx = Math.floor(indexOnPage / numCols);

    const cardX = marginLeft + colIdx * (CARD_WIDTH + colGap);
    const cardY = marginTop + rowIdx * (CARD_HEIGHT + rowGap);

    // 1. Draw Card Outline / Cutting Guide Line
    doc.setDrawColor(203, 213, 225); // Slate 300
    doc.setLineWidth(0.2);
    doc.roundedRect(cardX, cardY, CARD_WIDTH, CARD_HEIGHT, 2.5, 2.5, 'S');

    // 2. Corner Crop Marks outside the card
    if (showCropMarks) {
      doc.setDrawColor(148, 163, 184); // Slate 400
      doc.setLineWidth(0.15);
      const markLen = 2.5;

      // Top-Left
      doc.line(cardX - 1, cardY, cardX - 1 - markLen, cardY);
      doc.line(cardX, cardY - 1, cardX, cardY - 1 - markLen);
      // Top-Right
      doc.line(cardX + CARD_WIDTH + 1, cardY, cardX + CARD_WIDTH + 1 + markLen, cardY);
      doc.line(cardX + CARD_WIDTH, cardY - 1, cardX + CARD_WIDTH, cardY - 1 - markLen);
      // Bottom-Left
      doc.line(cardX - 1, cardY + CARD_HEIGHT, cardX - 1 - markLen, cardY + CARD_HEIGHT);
      doc.line(cardX, cardY + CARD_HEIGHT + 1, cardX, cardY + CARD_HEIGHT + 1 + markLen);
      // Bottom-Right
      doc.line(cardX + CARD_WIDTH + 1, cardY + CARD_HEIGHT, cardX + CARD_WIDTH + 1 + markLen, cardY + CARD_HEIGHT);
      doc.line(cardX + CARD_WIDTH, cardY + CARD_HEIGHT + 1, cardX + CARD_WIDTH, cardY + CARD_HEIGHT + 1 + markLen);
    }

    // 3. Card Header Strip (Height: 11.0 mm)
    doc.setFillColor(37, 99, 235); // Blue 600
    doc.roundedRect(cardX + 0.3, cardY + 0.3, CARD_WIDTH - 0.6, 11.0, 2.0, 2.0, 'F');
    // Square off bottom corners of header
    doc.rect(cardX + 0.3, cardY + 6.0, CARD_WIDTH - 0.6, 5.3, 'F');

    // Header Gold Accent Bar (Height: 0.8 mm)
    doc.setFillColor(245, 158, 11); // Amber 500
    doc.rect(cardX + 0.3, cardY + 11.0, CARD_WIDTH - 0.6, 0.8, 'F');

    // School Name & Header Text
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(6.5);
    doc.setTextColor(255, 255, 255);
    doc.text(school.schoolName, cardX + 3.0, cardY + 5.0);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(5.0);
    doc.setTextColor(191, 219, 254); // Blue 200
    doc.text('KARTU TANDA PELAJAR DIGITAL', cardX + 3.0, cardY + 8.5);

    // TA Badge on top-right of header
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(5.0);
    doc.setTextColor(255, 255, 255);
    doc.text(
      student.academicYear ? `TA ${student.academicYear}` : 'TA 2026/27',
      cardX + CARD_WIDTH - 3.5,
      cardY + 5.0,
      { align: 'right' }
    );

    // 4. Student Portrait Frame (Left: 3.5 mm, Top: 14.0 mm, Width: 18 mm, Height: 24 mm)
    const photoX = cardX + 3.5;
    const photoY = cardY + 14.0;
    const photoW = 18.0;
    const photoH = 24.0;

    doc.setFillColor(241, 245, 249); // Slate 100
    doc.setDrawColor(203, 213, 225); // Slate 300
    doc.setLineWidth(0.2);
    doc.roundedRect(photoX, photoY, photoW, photoH, 1.0, 1.0, 'FD');

    // Initial avatar placeholder
    const initials = student.fullName
      .split(' ')
      .slice(0, 2)
      .map((n) => n[0])
      .join('')
      .toUpperCase();
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(100, 116, 139);
    doc.text(initials, photoX + photoW / 2, photoY + photoH / 2 + 1.5, { align: 'center' });

    doc.setFontSize(4);
    doc.text('PAS FOTO', photoX + photoW / 2, photoY + photoH - 2.5, { align: 'center' });

    // 5. Identity Details (Left: 23.5 mm, Top: 14.5 mm)
    const infoX = cardX + 23.5;
    let textY = cardY + 16.0;

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(4.0);
    doc.setTextColor(100, 116, 139); // Slate 500
    doc.text('NAMA LENGKAP', infoX, textY);

    textY += 3.2;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(6.5);
    doc.setTextColor(15, 23, 42); // Slate 900
    // Truncate name if too long to fit
    const trimmedName =
      student.fullName.length > 20
        ? student.fullName.substring(0, 19) + '…'
        : student.fullName;
    doc.text(trimmedName, infoX, textY);

    textY += 3.8;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(4.0);
    doc.setTextColor(100, 116, 139);
    doc.text('NIS / NISN', infoX, textY);

    textY += 3.0;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(5.5);
    doc.setTextColor(30, 41, 59);
    doc.text(`${student.nis} / ${student.nisn}`, infoX, textY);

    textY += 3.8;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(4.0);
    doc.setTextColor(100, 116, 139);
    doc.text('KELAS', infoX, textY);

    textY += 3.2;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(6.5);
    doc.setTextColor(37, 99, 235); // Blue 600
    doc.text(student.className, infoX, textY);

    // 6. QR Code Area (Right: 3.5 mm from card edge, Top: 13.5 mm)
    const qrSize = 23.5;
    const qrX = cardX + CARD_WIDTH - qrSize - 3.5;
    const qrY = cardY + 13.5;

    doc.addImage(qrDataUrl, 'PNG', qrX, qrY, qrSize, qrSize);

    // Monospace Token Caption below QR
    const rawId = student.nis || student.id;
    const token = student.qrToken || generateSignedQrToken(rawId);
    doc.setFont('courier', 'bold');
    doc.setFontSize(4.2);
    doc.setTextColor(71, 85, 105); // Slate 600
    doc.text(token, qrX + qrSize / 2, qrY + qrSize + 2.5, { align: 'center' });

    // 7. Footer Security Microtext (Bottom of card)
    const footerY = cardY + CARD_HEIGHT - 3.2;
    doc.setDrawColor(226, 232, 240); // Slate 200
    doc.setLineWidth(0.2);
    doc.line(cardX + 0.3, footerY - 1.2, cardX + CARD_WIDTH - 0.3, footerY - 1.2);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(3.5);
    doc.setTextColor(148, 163, 184); // Slate 400
    doc.text(
      'SIHADIR-EDU SECURE QR • DILINDUNGI TANDA TANGAN KRIPTOGRAFIS HMAC-SHA256',
      cardX + CARD_WIDTH / 2,
      footerY + 1.0,
      { align: 'center' }
    );
  }

  const arrayBuffer = doc.output('arraybuffer');
  return Buffer.from(arrayBuffer);
}
