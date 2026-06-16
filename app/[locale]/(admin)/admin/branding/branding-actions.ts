'use server';

import { db } from '@/lib/db/drizzle';
import { branding } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { writeFile, mkdir } from 'fs/promises';
import { join } from 'path';

export async function updateBranding(formData: FormData) {
  const name = formData.get('name') as string;
  const logo = formData.get('logo') as File;
  const favicon = formData.get('favicon') as File;

  try {
    const uploadDir = join(process.cwd(), 'public/uploads/branding');
    await mkdir(uploadDir, { recursive: true });

    let logoUrl = '';
    if (logo) {
      const bytes = await logo.arrayBuffer();
      const buffer = Buffer.from(bytes);
      const path = join(uploadDir, logo.name);
      await writeFile(path, buffer);
      logoUrl = `/uploads/branding/${logo.name}`;
    }

    let faviconUrl = '';
    if (favicon && favicon.size > 0) {
      const bytes = await favicon.arrayBuffer();
      const buffer = Buffer.from(bytes);
      const filename = `${Date.now()}-${favicon.name}`;
      const path = join(uploadDir, filename);
      await writeFile(path, buffer);
      faviconUrl = `/uploads/branding/${filename}`;
    }

    const currentBranding = await db.query.branding.findFirst();

    if (currentBranding) {
      await db
        .update(branding)
        .set({
          name,
          logoUrl: logoUrl || currentBranding.logoUrl,
          faviconUrl: faviconUrl || currentBranding.faviconUrl,
          updatedAt: new Date(),
        })
        .where(eq(branding.id, currentBranding.id));
    } else {
      await db.insert(branding).values({
        name,
        logoUrl,
        faviconUrl,
      });
    }

    revalidatePath('/(admin)/admin/branding');
    revalidatePath('/');

    return {
      success: true,
    };
  } catch (error) {
    console.error(error);
    return {
      success: false,
      message: 'Failed to update branding.',
    };
  }
}