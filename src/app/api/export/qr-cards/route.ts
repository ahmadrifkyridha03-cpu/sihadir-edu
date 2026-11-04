import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { generateCr80QrCardsPdf, type StudentCardData } from '@/lib/export/qr-card-export';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const classId = searchParams.get('classId');
    const layout = (searchParams.get('layout') || '10_CARDS') as '10_CARDS' | '8_CARDS';

    const where: { status: 'ACTIVE'; classId?: string } = { status: 'ACTIVE' };
    if (classId) {
      where.classId = classId;
    }

    const students = await db.student.findMany({
      where,
      include: {
        class: {
          include: {
            academicYear: true,
          },
        },
      },
      orderBy: { fullName: 'asc' },
    });

    if (students.length === 0) {
      return NextResponse.json(
        { error: 'No active students found for QR card generation' },
        { status: 404 }
      );
    }

    const cardData: StudentCardData[] = students.map((s) => ({
      id: s.id,
      nis: s.nis,
      nisn: s.nisn,
      fullName: s.fullName,
      className: s.class.className,
      qrToken: s.qrToken,
      photoUrl: s.photoUrl,
      academicYear: s.class.academicYear?.yearName,
    }));

    const buffer = await generateCr80QrCardsPdf(cardData, { layout });
    const classLabel = classId && students[0] ? students[0].class.className : 'Semua_Siswa';
    const safeClassLabel = classLabel.replace(/[^a-zA-Z0-9_-]/g, '_');
    const filename = `Kartu_QR_CR80_${safeClassLabel}.pdf`;

    return new NextResponse(new Uint8Array(buffer), {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Cache-Control': 'no-store',
      },
    });
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: errorMsg }, { status: 500 });
  }
}
