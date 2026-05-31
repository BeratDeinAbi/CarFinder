import { NextRequest, NextResponse } from 'next/server';
import { startJob } from '@/lib/jobs';
import type { SearchFilters } from '@/lib/scrapers/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  let body: SearchFilters;
  try {
    body = (await req.json()) as SearchFilters;
  } catch {
    return NextResponse.json({ error: 'invalid JSON' }, { status: 400 });
  }
  if (!process.env.GEMINI_API_KEY) {
    return NextResponse.json(
      { error: 'GEMINI_API_KEY ist nicht gesetzt. Bitte in .env.local eintragen und Server neu starten.' },
      { status: 500 },
    );
  }
  const jobId = startJob(body);
  return NextResponse.json({ jobId });
}
