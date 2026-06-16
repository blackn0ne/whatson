'use server';

import { z } from 'zod';
import { db } from '@/lib/db/drizzle';
import { aiConfigs } from '@/lib/db/schema';
import { getTeamForUser } from '@/lib/db/queries';
import { eq } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import path from 'path';
import fs from 'fs/promises';
import { v4 as uuidv4 } from 'uuid';

export type AiActionState = {
  error?: string;
  success?: string;
};

const aiConfigSchema = z.object({
  isActive: z.boolean(),
  provider: z.enum(['openai', 'gemini']),
  model: z.string().min(1),
  apiKey: z.string().min(1, "API Key is required"),
  systemPrompt: z.string().optional(),
  temperature: z.number().min(0).max(2).optional(),
  maxOutputTokens: z.number().min(1).optional(),
});

export async function getAiConfig() {
  const team = await getTeamForUser();
  if (!team) return null;

  const config = await db.query.aiConfigs.findFirst({
    where: eq(aiConfigs.teamId, team.id),
  });

  return config;
}

export async function saveAiConfig(prevState: AiActionState, formData: FormData): Promise<AiActionState> {
  const team = await getTeamForUser();
  if (!team) return { error: 'Unauthorized' };

  const files = formData.getAll('files') as File[];
  const existingAttachmentsJson = formData.get('existingAttachments') as string;
  let attachments: { name: string; url: string; type: string; size: number }[] = [];

  try {
    if (existingAttachmentsJson) {
      attachments = JSON.parse(existingAttachmentsJson);
    }
  } catch (e) {
    console.error("Error parsing existing attachments", e);
  }

  if (files && files.length > 0) {
    const uploadDir = path.join(process.cwd(), 'public', 'uploads', 'ai-attachments');
    await fs.mkdir(uploadDir, { recursive: true });

    for (const file of files) {
      if (file.size > 0 && file.name !== 'undefined') {
        const extension = file.name.split('.').pop() || 'bin';
        const uniqueName = `${uuidv4()}.${extension}`;
        const filePath = path.join(uploadDir, uniqueName);
        const buffer = Buffer.from(await file.arrayBuffer());
        
        await fs.writeFile(filePath, buffer);
        
        attachments.push({
          name: file.name,
          url: `/uploads/ai-attachments/${uniqueName}`,
          type: file.type,
          size: file.size
        });
      }
    }
  }

  const rawData = {
    isActive: formData.get('isActive') === 'on',
    provider: formData.get('provider') as string,
    model: formData.get('model') as string,
    apiKey: formData.get('apiKey') as string,
    systemPrompt: formData.get('systemPrompt') as string,
    temperature: Number(formData.get('temperature')) || 0.7,
    maxOutputTokens: Number(formData.get('maxOutputTokens')) || 1000,
  };

  const validatedFields = aiConfigSchema.safeParse(rawData);

  if (!validatedFields.success) {
    return {
      error: validatedFields.error.issues[0].message,
    };
  }

  const dataToSave = {
    teamId: team.id,
    isActive: validatedFields.data.isActive,
    provider: validatedFields.data.provider,
    model: validatedFields.data.model,
    apiKey: validatedFields.data.apiKey,
    systemPrompt: validatedFields.data.systemPrompt,
    maxOutputTokens: validatedFields.data.maxOutputTokens,
    temperature: validatedFields.data.temperature?.toString() || '0.7',
    attachments: attachments,
    updatedAt: new Date(),
  };

  try {
    await db.insert(aiConfigs)
      .values(dataToSave)
      .onConflictDoUpdate({
        target: aiConfigs.teamId,
        set: dataToSave,
      });

    revalidatePath('/settings/ai');
    return { success: 'AI Configuration and knowledge base saved successfully.' };
  } catch (error) {
    console.error('Failed to save AI config:', error);
    return { error: 'Database error. Failed to save settings.' };
  }
}