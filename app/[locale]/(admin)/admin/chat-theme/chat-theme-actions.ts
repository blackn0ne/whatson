'use server';

import { db } from '@/lib/db/drizzle';
import { chatTheme } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { writeFile, mkdir } from 'fs/promises';
import { join } from 'path';

export async function updateChatTheme(formData: FormData) {
  const backgroundType = formData.get('backgroundType') as string;
  const backgroundColor = formData.get('backgroundColor') as string;
  const userBubbleColor = formData.get('userBubbleColor') as string;
  const contactBubbleColor = formData.get('contactBubbleColor') as string;
  const darkBackgroundColor = formData.get('darkBackgroundColor') as string;
  const darkUserBubbleColor = formData.get('darkUserBubbleColor') as string;
  const darkContactBubbleColor = formData.get('darkContactBubbleColor') as string;
  const backgroundImage = formData.get('backgroundImage') as File;

  try {
    const uploadDir = join(process.cwd(), 'public/uploads/chat-theme');
    await mkdir(uploadDir, { recursive: true });

    let backgroundImageUrl = '';
    if (backgroundImage && backgroundImage.size > 0) {
      const bytes = await backgroundImage.arrayBuffer();
      const buffer = Buffer.from(bytes);
      const filename = `${Date.now()}-${backgroundImage.name}`;
      const path = join(uploadDir, filename);
      await writeFile(path, buffer);
      backgroundImageUrl = `/uploads/chat-theme/${filename}`;
    }

    const current = await db.query.chatTheme.findFirst();

    const data = {
      backgroundType,
      backgroundColor,
      userBubbleColor,
      contactBubbleColor,
      darkBackgroundColor,
      darkUserBubbleColor,
      darkContactBubbleColor,
      backgroundImageUrl: backgroundImageUrl || (current?.backgroundImageUrl ?? null),
      updatedAt: new Date(),
    };

    if (current) {
      await db.update(chatTheme).set(data).where(eq(chatTheme.id, current.id));
    } else {
      await db.insert(chatTheme).values({
        ...data,
        backgroundImageUrl: backgroundImageUrl || null,
      });
    }

    revalidatePath('/(admin)/admin/chat-theme');
    revalidatePath('/dashboard/chat', 'layout');

    return { success: true };
  } catch (error) {
    console.error(error);
    return { success: false, message: 'Failed to update chat theme.' };
  }
}

export async function removeBackgroundImage() {
  try {
    const current = await db.query.chatTheme.findFirst();
    if (current) {
      await db.update(chatTheme).set({
        backgroundImageUrl: null,
        backgroundType: 'solid',
        updatedAt: new Date(),
      }).where(eq(chatTheme.id, current.id));
    }

    revalidatePath('/(admin)/admin/chat-theme');
    revalidatePath('/dashboard/chat', 'layout');

    return { success: true };
  } catch (error) {
    console.error(error);
    return { success: false, message: 'Failed to remove background image.' };
  }
}
