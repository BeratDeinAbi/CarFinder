import { NextRequest, NextResponse } from 'next/server';
import { getListing } from '@/lib/db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(_req: NextRequest, ctx: { params: { id: string } }) {
  const listing = getListing(ctx.params.id);
  if (!listing) return NextResponse.json({ error: 'not found' }, { status: 404 });
  return NextResponse.json(listing);
}
