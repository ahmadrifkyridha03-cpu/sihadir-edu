import { NextResponse } from 'next/server';
import { processWaNotificationQueue } from '@/lib/whatsapp';

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const batchSize = typeof body.batchSize === 'number' ? body.batchSize : 10;
    const minJitterSec = typeof body.minJitterSec === 'number' ? body.minJitterSec : undefined;
    const maxJitterSec = typeof body.maxJitterSec === 'number' ? body.maxJitterSec : undefined;

    const result = await processWaNotificationQueue({
      batchSize,
      minJitterSec,
      maxJitterSec,
    });

    return NextResponse.json({
      success: true,
      message: `Queue processed: ${result.sentCount} sent, ${result.failedCount} failed`,
      data: result,
    });
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    return NextResponse.json(
      { success: false, error: errorMsg },
      { status: 500 }
    );
  }
}

export async function GET() {
  try {
    const result = await processWaNotificationQueue({ batchSize: 5 });
    return NextResponse.json({
      success: true,
      message: `Queue processed: ${result.sentCount} sent, ${result.failedCount} failed`,
      data: result,
    });
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    return NextResponse.json(
      { success: false, error: errorMsg },
      { status: 500 }
    );
  }
}
