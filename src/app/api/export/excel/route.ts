import { NextRequest, NextResponse } from 'next/server';
import { generateAttendanceMatrixRecap } from '@/lib/analytics/recap-matrix';
import { evaluateClassEarlyWarning } from '@/lib/analytics/early-warning';
import { generateFullExcelWorkbook } from '@/lib/export/excel-export';
import { db } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    let classId = searchParams.get('classId');
    const year = searchParams.get('year') ? parseInt(searchParams.get('year')!, 10) : undefined;
    const month = searchParams.get('month') ? parseInt(searchParams.get('month')!, 10) : undefined;
    const semester = searchParams.get('semester') ? (parseInt(searchParams.get('semester')!, 10) as 1 | 2) : undefined;

    if (!classId) {
      const firstClass = await db.class.findFirst();
      if (!firstClass) {
        return NextResponse.json({ error: 'No classes found' }, { status: 404 });
      }
      classId = firstClass.id;
    }

    const [monthlyMatrix, semesterMatrix, ewsSummary] = await Promise.all([
      generateAttendanceMatrixRecap({ classId, periodType: 'MONTHLY', year, month, semester }),
      generateAttendanceMatrixRecap({ classId, periodType: 'SEMESTER', year, semester }),
      evaluateClassEarlyWarning({ classId, year, month, semester }),
    ]);

    const buffer = await generateFullExcelWorkbook({
      monthlyMatrix,
      semesterMatrix,
      ewsSummary,
    });

    const safeClassName = monthlyMatrix.classInfo.className.replace(/[^a-zA-Z0-9_-]/g, '_');
    const filename = `Rekap_Presensi_${safeClassName}_${monthlyMatrix.period.year}_${monthlyMatrix.period.month || 1}.xlsx`;

    return new NextResponse(new Uint8Array(buffer), {
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Cache-Control': 'no-store',
      },
    });
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: errorMsg }, { status: 500 });
  }
}
