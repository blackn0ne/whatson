import { NextResponse } from 'next/server';
import { getTeamForUser } from '@/lib/db/queries';
import { checkRoutePermission } from '@/lib/auth/permissions-guard';
import path from 'path';
import fs from 'fs/promises';
import { v4 as uuidv4 } from 'uuid';

export async function POST(request: Request) {
  try {
    const { error } = await checkRoutePermission('automation');
    if (error) return error;

    const team = await getTeamForUser();
    if (!team) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const formData = await request.formData();
    const file = formData.get('file') as File;

    if (!file) {
      return NextResponse.json({ error: 'No file uploaded' }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const extension = file.name.split('.').pop() || 'dat';
    const uniqueId = uuidv4();
    const filename = `${uniqueId}.${extension}`;
    
    
    const relativeDirPath = path.join('uploads', 'automation');
    const absoluteDirPath = path.join(process.cwd(), 'public', relativeDirPath);
    const absoluteFilePath = path.join(absoluteDirPath, filename);

    await fs.mkdir(absoluteDirPath, { recursive: true });
    await fs.writeFile(absoluteFilePath, buffer);

    const publicUrl = `/${relativeDirPath}/${filename}`;

    return NextResponse.json({ 
      url: publicUrl, 
      filename: file.name, 
      mimetype: file.type 
    });

  } catch (error) {
    console.error('Upload error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}