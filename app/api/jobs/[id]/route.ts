import { NextRequest, NextResponse } from 'next/server';
import { getJobResult } from '@/lib/jobs';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(_req: NextRequest, ctx: { params: { id: string } }) {
  const result = getJobResult(ctx.params.id);
  if (!result) return NextResponse.json({ error: 'not found' }, { status: 404 });
  return NextResponse.json(result);
}
