import { NextRequest, NextResponse } from 'next/server';
import { getUser, getUserWithTeam } from '@/lib/db/queries';
import { db } from '@/lib/db/drizzle';
import { twilioConfigs } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { readFile } from 'fs/promises';
import path from 'path';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const user = await getUser();
    if (!user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const userWithTeam = await getUserWithTeam(user.id);
    if (!userWithTeam?.teamId) {
      return NextResponse.json({ error: 'No team found' }, { status: 403 });
    }

    const sid = req.nextUrl.searchParams.get('sid');
    if (!sid || !/^RE[a-f0-9]+$/i.test(sid)) {
      return NextResponse.json({ error: 'Invalid recording SID' }, { status: 400 });
    }

    
    const localPath = path.join(process.cwd(), 'uploads', 'recordings', `${sid}.mp3`);
    try {
      const fileBuffer = await readFile(localPath);
      return new NextResponse(fileBuffer, {
        status: 200,
        headers: {
          'Content-Type': 'audio/mpeg',
          'Content-Length': fileBuffer.byteLength.toString(),
          'Cache-Control': 'private, max-age=86400',
        },
      });
    } catch {
      
    }

    
    const config = await db.query.twilioConfigs.findFirst({
      where: eq(twilioConfigs.isActive, true),
    });

    if (!config) {
      return NextResponse.json({ error: 'Twilio not configured' }, { status: 500 });
    }

    const recordingUrl = `https://api.twilio.com/2010-04-01/Accounts/${config.accountSid}/Recordings/${sid}.mp3`;
    const authHeader = Buffer.from(`${config.accountSid}:${config.authToken}`).toString('base64');

    const response = await fetch(recordingUrl, {
      headers: { Authorization: `Basic ${authHeader}` },
    });

    if (!response.ok) {
      return NextResponse.json(
        { error: 'Failed to fetch recording' },
        { status: response.status }
      );
    }

    const audioBuffer = await response.arrayBuffer();

    return new NextResponse(audioBuffer, {
      status: 200,
      headers: {
        'Content-Type': 'audio/mpeg',
        'Content-Length': audioBuffer.byteLength.toString(),
        'Cache-Control': 'private, max-age=3600',
      },
    });
  } catch (error: any) {
    console.error('[Recording Proxy]', error.message);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
