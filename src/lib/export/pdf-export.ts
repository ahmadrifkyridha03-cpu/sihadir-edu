import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { type AttendanceMatrixRecapResult } from '@/lib/analytics/recap-matrix';
import { getSchoolProfile } from './school-config';
import { formatIndoDate } from '@/lib/timezone';

/**
 * Generates an official printable PDF recap using jsPDF and jspdf-autotable.
 * Page layout: A4 Landscape (297 mm x 210 mm).
 */
export async function generateAttendanceMatrixPdf(
  matrix: AttendanceMatrixRecapResult
): Promise<Buffer> {
  const school = getSchoolProfile();
  const doc = new jsPDF({
    orientation: 'landscape',
    unit: 'mm',
    format: 'a4',
  });

  const pageWidth = 297;
  const pageHeight = 210;

  // 1. Official Kop Surat Header
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(71, 85, 105);
  doc.text(
    `${school.governingBody} • ${school.educationDepartment}`,
    pageWidth / 2,
    12,
    { align: 'center' }
  );

  doc.setFontSize(14);
  doc.setTextColor(30, 58, 138); // Dark Navy
  doc.text(school.schoolName, pageWidth / 2, 18, { align: 'center' });

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(100, 116, 139);
  doc.text(
    `${school.address} | Telp: ${school.phone} | Laman: ${school.website}`,
    pageWidth / 2,
    22,
    { align: 'center' }
  );

  // Double rule line for official Kop Surat
  doc.setDrawColor(0, 0, 0);
  doc.setLineWidth(0.6);
  doc.line(10, 24, pageWidth - 10, 24);
  doc.setLineWidth(0.2);
  doc.line(10, 25, pageWidth - 10, 25);

  // Document Title
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(15, 23, 42);
  doc.text(
    `REKAPITULASI PRESENSI SISWA — ${matrix.period.label.toUpperCase()}`,
    pageWidth / 2,
    30,
    { align: 'center' }
  );

  // Metadata block
  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.text(`Kelas / Fase : ${matrix.classInfo.className}`, 12, 35);
  doc.text(`Tahun Pelajaran : ${matrix.classInfo.academicYear?.yearName || '-'}`, 12, 39);
  doc.text(
    `Wali Kelas   : ${matrix.classInfo.homeroomTeacher?.fullName || '-'}`,
    110,
    35
  );
  doc.text(
    `Semester     : ${matrix.classInfo.academicYear?.semester === 1 ? '1 (Ganjil)' : '2 (Genap)'}`,
    110,
    39
  );
  doc.text(
    `Hari Efektif : ${matrix.period.elapsedEffectiveDays} Hari (Total ${matrix.period.totalEffectiveDays} Hari)`,
    210,
    35
  );
  doc.text(`NPSN         : ${school.npsn}`, 210, 39);

  // 2. Build AutoTable Data
  const headRow: string[] = ['No', 'NIS', 'Nama Siswa', 'L/P'];
  matrix.days.forEach((day) => {
    headRow.push(String(day.dayNumber));
  });
  headRow.push('H', 'S', 'I', 'A', 'T', '%');

  const bodyRows: (string | number)[][] = matrix.students.map((st, idx) => {
    const row: (string | number)[] = [
      idx + 1,
      st.nis,
      st.fullName,
      st.gender,
    ];
    matrix.days.forEach((d) => {
      row.push(st.dailyStatuses[d.date] || ' ');
    });
    row.push(
      st.summary.hadirCount,
      st.summary.sakitCount,
      st.summary.izinCount,
      st.summary.alpaCount,
      st.summary.terlambatCount,
      `${st.summary.attendanceRate}%`
    );
    return row;
  });

  // Calculate day column widths
  const dayColWidth = Math.max(3.8, Math.min(5.2, (pageWidth - 95) / matrix.days.length));

  autoTable(doc, {
    startY: 42,
    head: [headRow],
    body: bodyRows,
    theme: 'grid',
    styles: {
      fontSize: 6.5,
      cellPadding: 0.8,
      halign: 'center',
      valign: 'middle',
      lineColor: [203, 213, 225],
      lineWidth: 0.1,
    },
    headStyles: {
      fillColor: [30, 58, 138],
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      fontSize: 7,
    },
    columnStyles: {
      0: { cellWidth: 7 }, // No
      1: { cellWidth: 12 }, // NIS
      2: { cellWidth: 32, halign: 'left' }, // Nama Siswa
      3: { cellWidth: 7 }, // L/P
    },
    didParseCell: (data) => {
      // Color-code cells based on status
      if (data.section === 'body' && data.column.index >= 4 && data.column.index < 4 + matrix.days.length) {
        const val = String(data.cell.raw).trim();
        if (val === 'H') {
          data.cell.styles.fillColor = [209, 250, 229]; // Emerald 100
          data.cell.styles.textColor = [6, 95, 70];
          data.cell.styles.fontStyle = 'bold';
        } else if (val === 'T') {
          data.cell.styles.fillColor = [254, 243, 199]; // Amber 100
          data.cell.styles.textColor = [146, 64, 14];
          data.cell.styles.fontStyle = 'bold';
        } else if (val === 'S') {
          data.cell.styles.fillColor = [237, 233, 254]; // Violet 100
          data.cell.styles.textColor = [91, 33, 182];
        } else if (val === 'I') {
          data.cell.styles.fillColor = [224, 242, 254]; // Sky 100
          data.cell.styles.textColor = [7, 89, 133];
        } else if (val === 'A') {
          data.cell.styles.fillColor = [255, 228, 230]; // Rose 100
          data.cell.styles.textColor = [159, 18, 57];
          data.cell.styles.fontStyle = 'bold';
        } else if (val === 'B') {
          data.cell.styles.fillColor = [254, 226, 226]; // Red 100
          data.cell.styles.textColor = [185, 28, 28];
          data.cell.styles.fontStyle = 'bold';
        } else if (val === '-') {
          data.cell.styles.fillColor = [241, 245, 249]; // Slate 100
          data.cell.styles.textColor = [148, 163, 184];
        }
      }
    },
    margin: { left: 10, right: 10 },
  });

  // 3. Official Titi Mangsa Signature Block
  const finalY = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 8;
  const signatureY = finalY < pageHeight - 35 ? finalY : pageHeight - 35;

  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(15, 23, 42);

  // Date on right side
  doc.text(
    `${school.city}, ${formatIndoDate(matrix.period.endDate)}`,
    230,
    signatureY,
    { align: 'center' }
  );

  // Left signature: Kepala Sekolah
  doc.text('Mengetahui,', 40, signatureY + 4, { align: 'center' });
  doc.text(`Kepala ${school.schoolName}`, 40, signatureY + 8, { align: 'center' });
  doc.setFont('helvetica', 'bold');
  doc.text(school.principalName, 40, signatureY + 24, { align: 'center' });
  doc.setFont('helvetica', 'normal');
  doc.text(`NIP. ${school.principalNip}`, 40, signatureY + 28, { align: 'center' });

  // Right signature: Wali Kelas
  doc.text(`Wali Kelas ${matrix.classInfo.className}`, 230, signatureY + 8, {
    align: 'center',
  });
  doc.setFont('helvetica', 'bold');
  const homeroom = matrix.classInfo.homeroomTeacher;
  doc.text(homeroom?.fullName || 'Wali Kelas', 230, signatureY + 24, {
    align: 'center',
  });
  doc.setFont('helvetica', 'normal');
  doc.text(`NIP. ${homeroom?.nip || '-'}`, 230, signatureY + 28, { align: 'center' });

  const arrayBuffer = doc.output('arraybuffer');
  return Buffer.from(arrayBuffer);
}
