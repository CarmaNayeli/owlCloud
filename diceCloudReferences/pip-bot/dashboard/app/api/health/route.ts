import { NextResponse } from 'next/server';

export async function GET() {
  return NextResponse.json({
    status: 'ok',
    service: 'Pip Bot Dashboard',
    timestamp: new Date().toISOString(),
  });
}
