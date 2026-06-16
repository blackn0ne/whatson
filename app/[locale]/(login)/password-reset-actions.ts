'use server';

import { z } from 'zod';
import { eq, and, isNull, gt } from 'drizzle-orm';
import { db } from '@/lib/db/drizzle';
import { users, passwordResetTokens } from '@/lib/db/schema';
import { hashPassword } from '@/lib/auth/session';
import { sendPasswordResetEmail } from '@/lib/email';
import { randomUUID } from 'crypto';
import { ActionState } from '@/lib/auth/middleware';

const forgotPasswordSchema = z.object({
  email: z.string().email(),
});

export async function requestPasswordReset(
  prevState: ActionState,
  formData: FormData
): Promise<ActionState> {
  const result = forgotPasswordSchema.safeParse(Object.fromEntries(formData));
  if (!result.success) {
    return { error: result.error.issues[0].message };
  }

  const { email } = result.data;

  try {
    const [user] = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.email, email))
      .limit(1);

    if (user) {
      const token = randomUUID();
      const expiresAt = new Date(Date.now() + 60 * 60 * 1000); 

      await db.insert(passwordResetTokens).values({
        userId: user.id,
        token,
        expiresAt,
      });

      await sendPasswordResetEmail(email, token);
    }

    return { success: 'If an account with that email exists, a reset link has been sent.' };
  } catch (error) {
    console.error('Password reset request error:', error);
    return { error: 'Something went wrong. Please try again.' };
  }
}

const resetPasswordSchema = z.object({
  token: z.string().min(1),
  password: z.string().min(8).max(100),
  confirmPassword: z.string().min(8).max(100),
});

export async function resetPassword(
  prevState: ActionState,
  formData: FormData
): Promise<ActionState> {
  const result = resetPasswordSchema.safeParse(Object.fromEntries(formData));
  if (!result.success) {
    return { error: result.error.issues[0].message };
  }

  const { token, password, confirmPassword } = result.data;

  if (password !== confirmPassword) {
    return { error: 'Passwords do not match.' };
  }

  try {
    const [resetToken] = await db
      .select()
      .from(passwordResetTokens)
      .where(
        and(
          eq(passwordResetTokens.token, token),
          isNull(passwordResetTokens.usedAt),
          gt(passwordResetTokens.expiresAt, new Date())
        )
      )
      .limit(1);

    if (!resetToken) {
      return { error: 'Invalid or expired reset link. Please request a new one.' };
    }

    const passwordHash = await hashPassword(password);

    await Promise.all([
      db
        .update(users)
        .set({ passwordHash, updatedAt: new Date() })
        .where(eq(users.id, resetToken.userId)),
      db
        .update(passwordResetTokens)
        .set({ usedAt: new Date() })
        .where(eq(passwordResetTokens.id, resetToken.id)),
    ]);

    return { success: 'Password reset successfully. You can now sign in.' };
  } catch (error) {
    console.error('Password reset error:', error);
    return { error: 'Something went wrong. Please try again.' };
  }
}
