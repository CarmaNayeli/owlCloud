import { NextResponse } from 'next/server';
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

export async function GET() {
  try {
    const changelogPath = join(process.cwd(), '..', '..', 'CHANGELOG.md');

    if (!existsSync(changelogPath)) {
      return NextResponse.json({ content: 'Changelog not found' }, { status: 404 });
    }

    const content = readFileSync(changelogPath, 'utf-8');

    // Extract recent updates (first 100 lines)
    const lines = content.split('\n');
    const recentContent = lines.slice(0, 100).join('\n');

    return NextResponse.json({ content: recentContent });
  } catch (error) {
    console.error('Error reading changelog:', error);
    return NextResponse.json(
      { error: 'Failed to load changelog', content: '' },
      { status: 500 }
    );
  }
}
