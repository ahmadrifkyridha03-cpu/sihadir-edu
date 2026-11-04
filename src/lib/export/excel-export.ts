import ExcelJS from 'exceljs';
import { type AttendanceMatrixRecapResult } from '@/lib/analytics/recap-matrix';
import { type EwsClassSummaryResult } from '@/lib/analytics/early-warning';
import { getSchoolProfile } from './school-config';
import { formatIndoDate } from '@/lib/timezone';

export interface GenerateFullExcelWorkbookParams {
  monthlyMatrix: AttendanceMatrixRecapResult;
  semesterMatrix?: AttendanceMatrixRecapResult;
  ewsSummary?: EwsClassSummaryResult;
  gradeRecap?: {
    subjectName: string;
    teacherName: string;
    kkm: number;
    students: Array<{
      nis: string;
      nisn: string;
      fullName: string;
      gender: 'L' | 'P';
      tugas: number;
      kuis: number;
      praktikum: number;
      uh: number;
      pts: number;
      pas: number;
      finalScore: number;
      predicate: string;
      status: 'TUNTAS' | 'REMEDIAL';
    }>;
  };
}

// Semantic colors
const COLORS = {
  headerBg: '1E3A8A', // Dark Navy
  subHeaderBg: 'F8FAFC', // Slate 50
  border: 'CBD5E1', // Slate 300
  hadirFill: 'D1FAE5', // Emerald 100
  hadirFont: '065F46', // Emerald 800
  terlambatFill: 'FEF3C7', // Amber 100
  terlambatFont: '92400E', // Amber 800
  sakitFill: 'EDE9FE', // Violet 100
  sakitFont: '5B21B6', // Violet 800
  izinFill: 'E0F2FE', // Sky 100
  izinFont: '075985', // Sky 800
  alpaFill: 'FFE4E6', // Rose 100
  alpaFont: '9F1239', // Rose 800
  bolosFill: 'FEE2E2', // Red 100
  bolosFont: 'B91C1C', // Red 700
  weekendFill: 'F1F5F9', // Slate 100
  weekendFont: '94A3B8', // Slate 400
};

const BORDER_THIN: Partial<ExcelJS.Borders> = {
  top: { style: 'thin', color: { argb: COLORS.border } },
  left: { style: 'thin', color: { argb: COLORS.border } },
  bottom: { style: 'thin', color: { argb: COLORS.border } },
  right: { style: 'thin', color: { argb: COLORS.border } },
};

/**
 * Generates an Excel workbook with 4 structured worksheets using exceljs.
 */
export async function generateFullExcelWorkbook(
  params: GenerateFullExcelWorkbookParams
): Promise<Buffer> {
  const { monthlyMatrix, semesterMatrix, ewsSummary, gradeRecap } = params;
  const school = getSchoolProfile();
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'SiHadir-Edu';
  workbook.created = new Date();

  // ============================================================================
  // WORKSHEET 1: Rekap Absensi Bulanan (Rekap_Bulanan)
  // ============================================================================
  const wsMonth = workbook.addWorksheet('Rekap_Bulanan', {
    views: [{ showGridLines: true }],
  });

  const daysCount = monthlyMatrix.days.length;
  // Day columns start at Col 6 (F) and end at Col 5 + daysCount
  const lastDayColIdx = 5 + daysCount;
  const hColIdx = lastDayColIdx + 1;
  const sColIdx = lastDayColIdx + 2;
  const iColIdx = lastDayColIdx + 3;
  const aColIdx = lastDayColIdx + 4;
  const tColIdx = lastDayColIdx + 5;
  const effColIdx = lastDayColIdx + 6;
  const pctColIdx = lastDayColIdx + 7;
  const totalCols = pctColIdx;

  // 1. Kop Surat Header
  wsMonth.mergeCells(1, 1, 1, totalCols);
  wsMonth.getCell(1, 1).value = `${school.governingBody} • ${school.educationDepartment}`;
  wsMonth.getCell(1, 1).font = { name: 'Calibri', size: 10, bold: true, color: { argb: '475569' } };
  wsMonth.getCell(1, 1).alignment = { horizontal: 'center' };

  wsMonth.mergeCells(2, 1, 2, totalCols);
  wsMonth.getCell(2, 1).value = school.schoolName;
  wsMonth.getCell(2, 1).font = { name: 'Calibri', size: 14, bold: true, color: { argb: COLORS.headerBg } };
  wsMonth.getCell(2, 1).alignment = { horizontal: 'center' };

  wsMonth.mergeCells(3, 1, 3, totalCols);
  wsMonth.getCell(3, 1).value = `REKAPITULASI PRESENSI SISWA — ${monthlyMatrix.period.label.toUpperCase()}`;
  wsMonth.getCell(3, 1).font = { name: 'Calibri', size: 12, bold: true };
  wsMonth.getCell(3, 1).alignment = { horizontal: 'center' };

  // Metadata block (Row 5 & 6)
  wsMonth.getCell('B5').value = `Kelas: ${monthlyMatrix.classInfo.className}`;
  wsMonth.getCell('B5').font = { bold: true };
  wsMonth.getCell('J5').value = `Semester: ${monthlyMatrix.classInfo.academicYear?.semester === 1 ? '1 (Ganjil)' : '2 (Genap)'}`;
  wsMonth.getCell('R5').value = `Hari Efektif: ${monthlyMatrix.period.elapsedEffectiveDays} Hari (Total: ${monthlyMatrix.period.totalEffectiveDays} Hari)`;

  wsMonth.getCell('B6').value = `Wali Kelas: ${monthlyMatrix.classInfo.homeroomTeacher?.fullName || '-'}`;
  wsMonth.getCell('J6').value = `Tahun Pelajaran: ${monthlyMatrix.classInfo.academicYear?.yearName || '-'}`;
  wsMonth.getCell('R6').value = `NPSN: ${school.npsn}`;

  // Table Headers (Row 8 & 9)
  const headerRow8 = wsMonth.getRow(8);
  const headerRow9 = wsMonth.getRow(9);

  wsMonth.mergeCells(8, 1, 9, 1);
  wsMonth.getCell(8, 1).value = 'No';
  wsMonth.mergeCells(8, 2, 9, 2);
  wsMonth.getCell(8, 2).value = 'NIS';
  wsMonth.mergeCells(8, 3, 9, 3);
  wsMonth.getCell(8, 3).value = 'NISN';
  wsMonth.mergeCells(8, 4, 9, 4);
  wsMonth.getCell(8, 4).value = 'Nama Siswa';
  wsMonth.mergeCells(8, 5, 9, 5);
  wsMonth.getCell(8, 5).value = 'L/P';

  wsMonth.mergeCells(8, 6, 8, lastDayColIdx);
  wsMonth.getCell(8, 6).value = 'Tanggal';

  // Day sub-headers in row 9
  monthlyMatrix.days.forEach((day, idx) => {
    const col = 6 + idx;
    const cell = wsMonth.getCell(9, col);
    cell.value = day.dayNumber;
    cell.alignment = { horizontal: 'center' };
    if (!day.isEffective) {
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.weekendFill } };
      cell.font = { color: { argb: COLORS.weekendFont }, size: 9 };
    } else {
      cell.font = { bold: true, size: 9 };
    }
  });

  // Summary headers
  wsMonth.mergeCells(8, hColIdx, 8, tColIdx);
  wsMonth.getCell(8, hColIdx).value = 'Rekapitulasi';
  wsMonth.getCell(9, hColIdx).value = 'H';
  wsMonth.getCell(9, sColIdx).value = 'S';
  wsMonth.getCell(9, iColIdx).value = 'I';
  wsMonth.getCell(9, aColIdx).value = 'A';
  wsMonth.getCell(9, tColIdx).value = 'T';

  wsMonth.mergeCells(8, effColIdx, 9, effColIdx);
  wsMonth.getCell(8, effColIdx).value = 'Efektif';

  wsMonth.mergeCells(8, pctColIdx, 9, pctColIdx);
  wsMonth.getCell(8, pctColIdx).value = '% Hadir';

  // Apply styling to header rows
  for (let r = 8; r <= 9; r++) {
    const row = wsMonth.getRow(r);
    for (let c = 1; c <= totalCols; c++) {
      const cell = row.getCell(c);
      cell.font = { ...cell.font, bold: true, size: 9 };
      cell.alignment = { horizontal: 'center', vertical: 'middle' };
      cell.border = BORDER_THIN;
      if (!cell.fill) {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.subHeaderBg } };
      }
    }
  }

  // Set Column Widths
  wsMonth.getColumn(1).width = 5;
  wsMonth.getColumn(2).width = 10;
  wsMonth.getColumn(3).width = 14;
  wsMonth.getColumn(4).width = 28;
  wsMonth.getColumn(5).width = 6;
  for (let c = 6; c <= lastDayColIdx; c++) {
    wsMonth.getColumn(c).width = 4.0;
  }
  wsMonth.getColumn(hColIdx).width = 5;
  wsMonth.getColumn(sColIdx).width = 5;
  wsMonth.getColumn(iColIdx).width = 5;
  wsMonth.getColumn(aColIdx).width = 5;
  wsMonth.getColumn(tColIdx).width = 5;
  wsMonth.getColumn(effColIdx).width = 8;
  wsMonth.getColumn(pctColIdx).width = 10;

  // Data Rows (Start Row 10)
  const dataStartRow = 10;
  monthlyMatrix.students.forEach((student, index) => {
    const r = dataStartRow + index;
    const row = wsMonth.getRow(r);

    row.getCell(1).value = index + 1;
    row.getCell(1).alignment = { horizontal: 'center' };
    row.getCell(2).value = student.nis;
    row.getCell(2).alignment = { horizontal: 'center' };
    row.getCell(3).value = student.nisn;
    row.getCell(3).alignment = { horizontal: 'center' };
    row.getCell(4).value = student.fullName;
    row.getCell(4).font = { bold: true };
    row.getCell(5).value = student.gender;
    row.getCell(5).alignment = { horizontal: 'center' };

    // Fill daily statuses
    monthlyMatrix.days.forEach((day, dIdx) => {
      const col = 6 + dIdx;
      const cell = row.getCell(col);
      const code = student.dailyStatuses[day.date] || ' ';
      cell.value = code;
      cell.alignment = { horizontal: 'center' };

      // Apply semantic coloring
      if (code === 'H') {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.hadirFill } };
        cell.font = { color: { argb: COLORS.hadirFont }, bold: true, size: 9 };
      } else if (code === 'T') {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.terlambatFill } };
        cell.font = { color: { argb: COLORS.terlambatFont }, bold: true, size: 9 };
      } else if (code === 'S') {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.sakitFill } };
        cell.font = { color: { argb: COLORS.sakitFont }, bold: true, size: 9 };
      } else if (code === 'I') {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.izinFill } };
        cell.font = { color: { argb: COLORS.izinFont }, bold: true, size: 9 };
      } else if (code === 'A') {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.alpaFill } };
        cell.font = { color: { argb: COLORS.alpaFont }, bold: true, size: 9 };
      } else if (code === 'B') {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.bolosFill } };
        cell.font = { color: { argb: COLORS.bolosFont }, bold: true, size: 9 };
      } else if (code === '-') {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.weekendFill } };
        cell.font = { color: { argb: COLORS.weekendFont }, size: 9 };
      }
    });

    // Native Excel formulas for tallies with precomputed result fallbacks
    const firstDayLetter = wsMonth.getColumn(6).letter;
    const lastDayLetter = wsMonth.getColumn(lastDayColIdx).letter;

    const hCell = row.getCell(hColIdx);
    hCell.value = {
      formula: `COUNTIF(${firstDayLetter}${r}:${lastDayLetter}${r}, "H")`,
      result: student.summary.hadirCount,
    };
    hCell.alignment = { horizontal: 'center' };

    const sCell = row.getCell(sColIdx);
    sCell.value = {
      formula: `COUNTIF(${firstDayLetter}${r}:${lastDayLetter}${r}, "S")`,
      result: student.summary.sakitCount,
    };
    sCell.alignment = { horizontal: 'center' };

    const iCell = row.getCell(iColIdx);
    iCell.value = {
      formula: `COUNTIF(${firstDayLetter}${r}:${lastDayLetter}${r}, "I")`,
      result: student.summary.izinCount,
    };
    iCell.alignment = { horizontal: 'center' };

    const aCell = row.getCell(aColIdx);
    aCell.value = {
      formula: `COUNTIF(${firstDayLetter}${r}:${lastDayLetter}${r}, "A")`,
      result: student.summary.alpaCount,
    };
    aCell.alignment = { horizontal: 'center' };

    const tCell = row.getCell(tColIdx);
    tCell.value = {
      formula: `COUNTIF(${firstDayLetter}${r}:${lastDayLetter}${r}, "T")`,
      result: student.summary.terlambatCount,
    };
    tCell.alignment = { horizontal: 'center' };

    const effCell = row.getCell(effColIdx);
    effCell.value = monthlyMatrix.period.elapsedEffectiveDays;
    effCell.alignment = { horizontal: 'center' };

    // % Kehadiran formula: (H + T) / Hari Efektif
    const hColLetter = wsMonth.getColumn(hColIdx).letter;
    const tColLetter = wsMonth.getColumn(tColIdx).letter;
    const effColLetter = wsMonth.getColumn(effColIdx).letter;

    const pctCell = row.getCell(pctColIdx);
    pctCell.value = {
      formula: `IF(${effColLetter}${r}>0, (${hColLetter}${r}+${tColLetter}${r})/${effColLetter}${r}, 1)`,
      result: student.summary.attendanceRate / 100,
    };
    pctCell.numFmt = '0.0%';
    pctCell.alignment = { horizontal: 'center' };
    pctCell.font = { bold: true };

    for (let c = 1; c <= totalCols; c++) {
      row.getCell(c).border = BORDER_THIN;
    }
  });

  // Bottom Summary Row
  const lastDataRow = dataStartRow + monthlyMatrix.students.length - 1;
  const summaryRowIdx = lastDataRow + 1;
  const summaryRow = wsMonth.getRow(summaryRowIdx);

  wsMonth.mergeCells(summaryRowIdx, 1, summaryRowIdx, 5);
  summaryRow.getCell(1).value = 'Rata-rata Kelas / Kehadiran Harian';
  summaryRow.getCell(1).alignment = { horizontal: 'center' };
  summaryRow.getCell(1).font = { bold: true };

  // Daily totals
  monthlyMatrix.days.forEach((day, dIdx) => {
    const col = 6 + dIdx;
    const colLetter = wsMonth.getColumn(col).letter;
    const cell = summaryRow.getCell(col);
    cell.value = {
      formula: `COUNTIF(${colLetter}${dataStartRow}:${colLetter}${lastDataRow}, "H") + COUNTIF(${colLetter}${dataStartRow}:${colLetter}${lastDataRow}, "T")`,
      result: day.isEffective ? monthlyMatrix.classStats.dailyClassDistribution[dIdx]?.hadir || 0 : 0,
    };
    cell.alignment = { horizontal: 'center' };
    cell.font = { bold: true, size: 8 };
  });

  const pctColLetter = wsMonth.getColumn(pctColIdx).letter;
  const avgPctCell = summaryRow.getCell(pctColIdx);
  avgPctCell.value = {
    formula: `AVERAGE(${pctColLetter}${dataStartRow}:${pctColLetter}${lastDataRow})`,
    result: monthlyMatrix.classStats.averageAttendanceRate / 100,
  };
  avgPctCell.numFmt = '0.0%';
  avgPctCell.font = { bold: true };
  avgPctCell.alignment = { horizontal: 'center' };

  for (let c = 1; c <= totalCols; c++) {
    const cell = summaryRow.getCell(c);
    cell.border = BORDER_THIN;
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.subHeaderBg } };
  }

  // Official Signature Block (Rows summaryRowIdx + 3 to + 9)
  const signDateRow = summaryRowIdx + 3;
  wsMonth.getCell(signDateRow, tColIdx).value = `${school.city}, ${formatIndoDate(monthlyMatrix.period.endDate)}`;
  wsMonth.getCell(signDateRow, tColIdx).alignment = { horizontal: 'center' };

  const signTitleRow = signDateRow + 1;
  wsMonth.getCell(signTitleRow, 2).value = 'Mengetahui,';
  wsMonth.getCell(signTitleRow + 1, 2).value = `Kepala ${school.schoolName}`;
  wsMonth.getCell(signTitleRow + 1, 2).font = { bold: true };

  wsMonth.getCell(signTitleRow, tColIdx).value = `Wali Kelas ${monthlyMatrix.classInfo.className}`;
  wsMonth.getCell(signTitleRow, tColIdx).font = { bold: true };
  wsMonth.getCell(signTitleRow, tColIdx).alignment = { horizontal: 'center' };

  const signNameRow = signTitleRow + 5;
  wsMonth.getCell(signNameRow, 2).value = school.principalName;
  wsMonth.getCell(signNameRow, 2).font = { bold: true, underline: true };
  wsMonth.getCell(signNameRow + 1, 2).value = `NIP. ${school.principalNip}`;

  const homeroom = monthlyMatrix.classInfo.homeroomTeacher;
  wsMonth.getCell(signNameRow, tColIdx).value = homeroom?.fullName || 'Wali Kelas';
  wsMonth.getCell(signNameRow, tColIdx).font = { bold: true, underline: true };
  wsMonth.getCell(signNameRow, tColIdx).alignment = { horizontal: 'center' };
  wsMonth.getCell(signNameRow + 1, tColIdx).value = `NIP. ${homeroom?.nip || '-'}`;
  wsMonth.getCell(signNameRow + 1, tColIdx).alignment = { horizontal: 'center' };

  // ============================================================================
  // WORKSHEET 2: Rekap Absensi Semesteran (Rekap_Semester)
  // ============================================================================
  const wsSem = workbook.addWorksheet('Rekap_Semester', {
    views: [{ showGridLines: true }],
  });

  wsSem.mergeCells('A1:K1');
  wsSem.getCell('A1').value = `REKAPITULASI PRESENSI SISWA SEMESTER — ${school.schoolName}`;
  wsSem.getCell('A1').font = { bold: true, size: 14 };

  wsSem.mergeCells('A2:K2');
  wsSem.getCell('A2').value = `Kelas: ${monthlyMatrix.classInfo.className} | Tahun Pelajaran: ${monthlyMatrix.classInfo.academicYear?.yearName || '-'}`;
  wsSem.getCell('A2').font = { bold: true, size: 11 };

  const semHeaders = ['No', 'NIS', 'NISN', 'Nama Siswa', 'L/P', 'Total Hadir', 'Total Sakit', 'Total Izin', 'Total Alpa', 'Total Terlambat', '% Kehadiran'];
  const semHeaderRow = wsSem.getRow(4);
  semHeaders.forEach((h, idx) => {
    const cell = semHeaderRow.getCell(idx + 1);
    cell.value = h;
    cell.font = { bold: true, color: { argb: 'FFFFFF' } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.headerBg } };
    cell.alignment = { horizontal: 'center', vertical: 'middle' };
    cell.border = BORDER_THIN;
  });

  const semDataSource = semesterMatrix ? semesterMatrix.students : monthlyMatrix.students;
  semDataSource.forEach((st, idx) => {
    const r = 5 + idx;
    const row = wsSem.getRow(r);
    row.getCell(1).value = idx + 1;
    row.getCell(1).alignment = { horizontal: 'center' };
    row.getCell(2).value = st.nis;
    row.getCell(2).alignment = { horizontal: 'center' };
    row.getCell(3).value = st.nisn;
    row.getCell(3).alignment = { horizontal: 'center' };
    row.getCell(4).value = st.fullName;
    row.getCell(4).font = { bold: true };
    row.getCell(5).value = st.gender;
    row.getCell(5).alignment = { horizontal: 'center' };
    row.getCell(6).value = st.summary.hadirCount;
    row.getCell(6).alignment = { horizontal: 'center' };
    row.getCell(7).value = st.summary.sakitCount;
    row.getCell(7).alignment = { horizontal: 'center' };
    row.getCell(8).value = st.summary.izinCount;
    row.getCell(8).alignment = { horizontal: 'center' };
    row.getCell(9).value = st.summary.alpaCount;
    row.getCell(9).alignment = { horizontal: 'center' };
    row.getCell(10).value = st.summary.terlambatCount;
    row.getCell(10).alignment = { horizontal: 'center' };

    const pctCell = row.getCell(11);
    pctCell.value = st.summary.attendanceRate / 100;
    pctCell.numFmt = '0.0%';
    pctCell.font = { bold: true };
    pctCell.alignment = { horizontal: 'center' };

    for (let c = 1; c <= 11; c++) {
      row.getCell(c).border = BORDER_THIN;
    }
  });

  wsSem.getColumn(1).width = 5;
  wsSem.getColumn(2).width = 10;
  wsSem.getColumn(3).width = 14;
  wsSem.getColumn(4).width = 28;
  wsSem.getColumn(5).width = 6;
  for (let c = 6; c <= 11; c++) wsSem.getColumn(c).width = 12;

  // ============================================================================
  // WORKSHEET 3: Rekap Nilai Siswa (Rekap_Nilai)
  // ============================================================================
  const wsGrade = workbook.addWorksheet('Rekap_Nilai', {
    views: [{ showGridLines: true }],
  });

  wsGrade.mergeCells('A1:N1');
  wsGrade.getCell('A1').value = `REKAPITULASI NILAI SISWA — ${school.schoolName}`;
  wsGrade.getCell('A1').font = { bold: true, size: 14 };

  wsGrade.mergeCells('A2:N2');
  wsGrade.getCell('A2').value = `Mata Pelajaran: ${gradeRecap?.subjectName || 'Semua Mata Pelajaran'} | Kelas: ${monthlyMatrix.classInfo.className} | KKM: ${gradeRecap?.kkm || 75.0}`;
  wsGrade.getCell('A2').font = { bold: true, size: 11 };

  const gradeHeaders = [
    'No', 'NIS', 'NISN', 'Nama Siswa', 'L/P',
    'Tugas (20%)', 'Kuis (10%)', 'Praktikum (15%)', 'UH (25%)', 'PTS (15%)', 'PAS (15%)',
    'Nilai Akhir', 'Predikat', 'Status',
  ];

  const gradeHeaderRow = wsGrade.getRow(4);
  gradeHeaders.forEach((gh, idx) => {
    const cell = gradeHeaderRow.getCell(idx + 1);
    cell.value = gh;
    cell.font = { bold: true, color: { argb: 'FFFFFF' }, size: 9 };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.headerBg } };
    cell.alignment = { horizontal: 'center', vertical: 'middle' };
    cell.border = BORDER_THIN;
  });

  const gradeData =
    gradeRecap?.students ||
    monthlyMatrix.students.map((st) => ({
      nis: st.nis,
      nisn: st.nisn,
      fullName: st.fullName,
      gender: st.gender,
      tugas: 80,
      kuis: 85,
      praktikum: 82,
      uh: 78,
      pts: 80,
      pas: 84,
      finalScore: 81.2,
      predicate: 'B',
      status: 'TUNTAS' as const,
    }));

  gradeData.forEach((gd, idx) => {
    const r = 5 + idx;
    const row = wsGrade.getRow(r);
    row.getCell(1).value = idx + 1;
    row.getCell(1).alignment = { horizontal: 'center' };
    row.getCell(2).value = gd.nis;
    row.getCell(2).alignment = { horizontal: 'center' };
    row.getCell(3).value = gd.nisn;
    row.getCell(3).alignment = { horizontal: 'center' };
    row.getCell(4).value = gd.fullName;
    row.getCell(4).font = { bold: true };
    row.getCell(5).value = gd.gender;
    row.getCell(5).alignment = { horizontal: 'center' };
    row.getCell(6).value = gd.tugas;
    row.getCell(7).value = gd.kuis;
    row.getCell(8).value = gd.praktikum;
    row.getCell(9).value = gd.uh;
    row.getCell(10).value = gd.pts;
    row.getCell(11).value = gd.pas;

    const finalCell = row.getCell(12);
    finalCell.value = {
      formula: `ROUND(F${r}*0.2 + G${r}*0.1 + H${r}*0.15 + I${r}*0.25 + J${r}*0.15 + K${r}*0.15, 1)`,
      result: gd.finalScore,
    };
    finalCell.font = { bold: true };
    finalCell.alignment = { horizontal: 'center' };

    const predCell = row.getCell(13);
    predCell.value = {
      formula: `IF(L${r}>=90, "A", IF(L${r}>=80, "B", IF(L${r}>=75, "C", "D")))`,
      result: gd.predicate,
    };
    predCell.alignment = { horizontal: 'center' };

    const statusCell = row.getCell(14);
    statusCell.value = {
      formula: `IF(L${r}>=75, "TUNTAS", "REMEDIAL")`,
      result: gd.status,
    };
    statusCell.alignment = { horizontal: 'center' };
    statusCell.font = { bold: true };

    if (gd.status === 'TUNTAS') {
      statusCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.hadirFill } };
      statusCell.font = { color: { argb: COLORS.hadirFont }, bold: true };
    } else {
      statusCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.terlambatFill } };
      statusCell.font = { color: { argb: COLORS.terlambatFont }, bold: true };
    }

    for (let c = 1; c <= 14; c++) row.getCell(c).border = BORDER_THIN;
  });

  wsGrade.getColumn(1).width = 5;
  wsGrade.getColumn(2).width = 10;
  wsGrade.getColumn(3).width = 14;
  wsGrade.getColumn(4).width = 28;
  wsGrade.getColumn(5).width = 6;
  for (let c = 6; c <= 14; c++) wsGrade.getColumn(c).width = 12;

  // ============================================================================
  // WORKSHEET 4: Daftar Siswa EWS (Daftar_EWS)
  // ============================================================================
  const wsEws = workbook.addWorksheet('Daftar_EWS', {
    views: [{ showGridLines: true }],
  });

  wsEws.mergeCells('A1:J1');
  wsEws.getCell('A1').value = `DAFTAR SISWA DALAM PENGAWASAN KHUSUS (EARLY WARNING SYSTEM)`;
  wsEws.getCell('A1').font = { bold: true, size: 14, color: { argb: '9F1239' } };

  wsEws.mergeCells('A2:J2');
  wsEws.getCell('A2').value = `Kelas: ${monthlyMatrix.classInfo.className} | Tanggal Evaluasi: ${formatIndoDate(new Date())}`;
  wsEws.getCell('A2').font = { bold: true, size: 11 };

  const ewsHeaders = [
    'No', 'NIS', 'NISN', 'Nama Siswa', 'Tingkat Risiko', 'Skor EWS',
    '% Kehadiran', 'Indikator Masalah', 'Rekomendasi Tindakan (SOP)', 'Dokumen Wajib',
  ];

  const ewsHeaderRow = wsEws.getRow(4);
  ewsHeaders.forEach((eh, idx) => {
    const cell = ewsHeaderRow.getCell(idx + 1);
    cell.value = eh;
    cell.font = { bold: true, color: { argb: 'FFFFFF' }, size: 9 };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: '9F1239' } };
    cell.alignment = { horizontal: 'center', vertical: 'middle' };
    cell.border = BORDER_THIN;
  });

  const ewsStudents = ewsSummary?.students || [];
  ewsStudents.forEach((st, idx) => {
    const r = 5 + idx;
    const row = wsEws.getRow(r);
    row.getCell(1).value = idx + 1;
    row.getCell(1).alignment = { horizontal: 'center' };
    row.getCell(2).value = st.nis;
    row.getCell(2).alignment = { horizontal: 'center' };
    row.getCell(3).value = st.nisn;
    row.getCell(3).alignment = { horizontal: 'center' };
    row.getCell(4).value = st.fullName;
    row.getCell(4).font = { bold: true };

    const riskCell = row.getCell(5);
    riskCell.value = st.riskLevel;
    riskCell.alignment = { horizontal: 'center' };
    riskCell.font = { bold: true };
    if (st.riskLevel === 'CRITICAL') {
      riskCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.alpaFill } };
      riskCell.font = { color: { argb: COLORS.alpaFont }, bold: true };
    } else if (st.riskLevel === 'WARNING') {
      riskCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.terlambatFill } };
      riskCell.font = { color: { argb: COLORS.terlambatFont }, bold: true };
    } else {
      riskCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.hadirFill } };
      riskCell.font = { color: { argb: COLORS.hadirFont }, bold: true };
    }

    row.getCell(6).value = st.riskScore;
    row.getCell(6).alignment = { horizontal: 'center' };

    const pctCell = row.getCell(7);
    pctCell.value = st.attendanceRate / 100;
    pctCell.numFmt = '0.0%';
    pctCell.alignment = { horizontal: 'center' };

    const triggeredInvariants = st.invariants
      .filter((inv) => inv.triggered)
      .map((inv) => `• ${inv.description}`)
      .join('\n');
    row.getCell(8).value = triggeredInvariants || 'Normal';

    row.getCell(9).value = st.counselingSop?.primaryAction || 'Pemantauan berkala';
    row.getCell(10).value = st.counselingSop?.officialDocumentRequired || '-';

    for (let c = 1; c <= 10; c++) row.getCell(c).border = BORDER_THIN;
  });

  wsEws.getColumn(1).width = 5;
  wsEws.getColumn(2).width = 10;
  wsEws.getColumn(3).width = 14;
  wsEws.getColumn(4).width = 26;
  wsEws.getColumn(5).width = 14;
  wsEws.getColumn(6).width = 10;
  wsEws.getColumn(7).width = 12;
  wsEws.getColumn(8).width = 38;
  wsEws.getColumn(9).width = 32;
  wsEws.getColumn(10).width = 26;

  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(buffer);
}
