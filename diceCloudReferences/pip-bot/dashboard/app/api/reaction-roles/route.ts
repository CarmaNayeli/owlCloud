import { NextResponse } from 'next/server';
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

export async function GET() {
  try {
    const dataPath = join(process.cwd(), '..', 'data', 'reaction-roles.json');

    if (!existsSync(dataPath)) {
      return NextResponse.json({ messages: {} });
    }

    const data = readFileSync(dataPath, 'utf-8');
    const jsonData = JSON.parse(data);

    return NextResponse.json(jsonData);
  } catch (error) {
    console.error('Error reading reaction roles:', error);
    return NextResponse.json(
      { error: 'Failed to load reaction roles', messages: {} },
      { status: 500 }
    );
  }
}
