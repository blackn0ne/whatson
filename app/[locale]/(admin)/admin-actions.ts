'use server';

import { db } from '@/lib/db/drizzle';
import { users, teams, plans, teamMembers, activityLogs, invitations, passwordResetTokens, paymentGateways } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { getUser } from '@/lib/db/queries';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import { hashPassword } from '@/lib/auth/session';
import { sendPasswordResetEmail } from '@/lib/email';
import { randomUUID } from 'crypto';
import { StripeAdapter } from '@/lib/payments/adapters/stripe-adapter';

export type ActionState = {
  error?: string;
  success?: string;
};

const planSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  amount: z.coerce.number().min(0),
  currency: z.string().min(3).max(3).default('usd'),
  interval: z.enum(['month', 'year']),
  trialDays: z.coerce.number().min(0).default(0),
  maxUsers: z.coerce.number().min(1),
  maxContacts: z.coerce.number().min(0),
  maxInstances: z.coerce.number().min(0),
  isAiEnabled: z.boolean(),
  isFlowBuilderEnabled: z.boolean(),
  isCampaignsEnabled: z.boolean(),
  isTemplatesEnabled: z.boolean(),
  isVoiceCallsEnabled: z.boolean(),
});

async function verifyAdmin() {
  const user = await getUser();
  if (!user || user.role !== 'admin') {
    throw new Error('Unauthorized');
  }
  return user;
}

export async function updateUserRole(userId: number, role: string): Promise<ActionState> {
  try {
    const currentUser = await verifyAdmin();

    if (currentUser.id === userId) {
      return { error: 'Cannot change your own role.' };
    }

    const validRoles = ['admin', 'member', 'owner'];
    if (!validRoles.includes(role)) {
      return { error: 'Invalid role.' };
    }

    await db.update(users).set({ role, updatedAt: new Date() }).where(eq(users.id, userId));
    revalidatePath('/admin/users');
    return { success: 'Role updated successfully' };
  } catch (error: any) {
    return { error: error.message || 'Failed to update role' };
  }
}

export async function adminSendResetLink(userId: number): Promise<ActionState> {
  try {
    await verifyAdmin();

    const [user] = await db
      .select({ id: users.id, email: users.email })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    if (!user) return { error: 'User not found.' };

    const token = randomUUID();
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000);

    await db.insert(passwordResetTokens).values({
      userId: user.id,
      token,
      expiresAt,
    });

    await sendPasswordResetEmail(user.email, token);
    return { success: 'Reset link sent successfully.' };
  } catch (error: any) {
    return { error: error.message || 'Failed to send reset link.' };
  }
}

export async function adminSetPassword(userId: number, newPassword: string): Promise<ActionState> {
  try {
    const currentUser = await verifyAdmin();

    if (newPassword.length < 8) {
      return { error: 'Password must be at least 8 characters.' };
    }

    const passwordHash = await hashPassword(newPassword);
    await db.update(users).set({ passwordHash, updatedAt: new Date() }).where(eq(users.id, userId));
    return { success: 'Password updated successfully.' };
  } catch (error: any) {
    return { error: error.message || 'Failed to update password.' };
  }
}

export async function deleteUser(userId: number): Promise<ActionState> {
  try {
    const currentUser = await verifyAdmin();

    if (currentUser.id === userId) {
      return { error: 'Cannot delete your own account.' };
    }

    await db.delete(teamMembers).where(eq(teamMembers.userId, userId));
    await db.delete(activityLogs).where(eq(activityLogs.userId, userId));
    
    await db.delete(users).where(eq(users.id, userId));
    revalidatePath('/admin/users');
    return { success: 'User deleted successfully' };
  } catch (error: any) {
    return { error: error.message || 'Failed to delete user' };
  }
}

export async function deleteTeam(teamId: number): Promise<ActionState> {
  try {
    await verifyAdmin();

    if (teamId === 1) {
      return { error: 'Cannot delete the system admin team.' };
    }

    await db.delete(teamMembers).where(eq(teamMembers.teamId, teamId));
    await db.delete(activityLogs).where(eq(activityLogs.teamId, teamId));
    await db.delete(invitations).where(eq(invitations.teamId, teamId));

    await db.delete(teams).where(eq(teams.id, teamId));
    
    revalidatePath('/admin/teams');
    return { success: 'Team deleted successfully' };
  } catch (error: any) {
    console.error('Delete team error:', error);
    return { error: error.message || 'Failed to delete team' };
  }
}

export async function upsertPlan(prevState: ActionState, formData: FormData): Promise<ActionState> {
  try {
    await verifyAdmin();

    const id = formData.get('id') as string;
    const gatewayIdRaw = formData.get('gatewayId') as string;
    const gatewayId = gatewayIdRaw && gatewayIdRaw !== 'none' ? parseInt(gatewayIdRaw) : null;

    const rawAmount = parseFloat(formData.get('amount') as string || '0');
    const amountInCents = Math.round(rawAmount * 100);

    const rawData = {
      name: formData.get('name'),
      description: formData.get('description'),
      amount: amountInCents,
      currency: formData.get('currency') || 'usd',
      interval: formData.get('interval'),
      trialDays: formData.get('trialDays'),
      maxUsers: formData.get('maxUsers'),
      maxContacts: formData.get('maxContacts'),
      maxInstances: formData.get('maxInstances'),
      isAiEnabled: formData.get('isAiEnabled') === 'on',
      isFlowBuilderEnabled: formData.get('isFlowBuilderEnabled') === 'on',
      isCampaignsEnabled: formData.get('isCampaignsEnabled') === 'on',
      isTemplatesEnabled: formData.get('isTemplatesEnabled') === 'on',
      isVoiceCallsEnabled: formData.get('isVoiceCallsEnabled') === 'on',
    };

    const validated = planSchema.safeParse(rawData);
    if (!validated.success) {
      return { error: validated.error.issues[0].message };
    }

    const { name, description, amount, currency, interval } = validated.data;
    let stripeProductId = '';
    let stripePriceId = '';
    let gatewayProductId: string | null = null;
    let gatewayPriceId: string | null = null;

    if (gatewayId && amount > 0) {
      const gw = await db.query.paymentGateways.findFirst({
        where: eq(paymentGateways.id, gatewayId),
      });

      if (gw && gw.gateway === 'stripe') {
        const stripeAdapter = new StripeAdapter(gw.secretKey);
        const stripeClient = stripeAdapter.stripeClient;

        if (id) {
          const existingPlan = await db.query.plans.findFirst({ where: eq(plans.id, parseInt(id)) });
          if (!existingPlan) return { error: 'Plan not found' };

          
          const productId = existingPlan.gatewayProductId || existingPlan.stripeProductId;
          if (productId) {
            try { await stripeClient.products.update(productId, { name, description: description || undefined }); } catch {}
            gatewayProductId = productId;
          } else {
            const product = await stripeClient.products.create({ name, description: description || undefined });
            gatewayProductId = product.id;
          }

          if (existingPlan.amount !== amount || existingPlan.interval !== interval || !existingPlan.gatewayPriceId) {
            const newPrice = await stripeClient.prices.create({
              product: gatewayProductId,
              unit_amount: amount,
              currency,
              recurring: { interval: interval as 'month' | 'year' },
            });
            gatewayPriceId = newPrice.id;
          } else {
            gatewayPriceId = existingPlan.gatewayPriceId;
          }
        } else {
          const product = await stripeClient.products.create({ name, description: description || undefined });
          gatewayProductId = product.id;
          const price = await stripeClient.prices.create({
            product: product.id,
            unit_amount: amount,
            currency,
            recurring: { interval: interval as 'month' | 'year' },
          });
          gatewayPriceId = price.id;
        }

        
        stripeProductId = gatewayProductId;
        stripePriceId = gatewayPriceId;

      } else if (gw && (gw.gateway === 'razorpay' || gw.gateway === 'offline')) {
        
        gatewayProductId = null;
        gatewayPriceId = null;
      }
    }

    const dataToSave = {
      ...validated.data,
      gatewayId,
      gatewayProductId,
      gatewayPriceId,
      stripeProductId,
      stripePriceId,
      updatedAt: new Date(),
    };

    if (id) {
      await db.update(plans).set(dataToSave).where(eq(plans.id, parseInt(id)));
    } else {
      await db.insert(plans).values(dataToSave);
    }

  } catch (error: any) {
    return { error: error.message };
  }

  revalidatePath('/admin/plans');
  redirect('/admin/plans');
}

export async function deletePlan(planId: number): Promise<ActionState> {
  try {
    await verifyAdmin();
    
    if (planId === 1) {
      return { error: 'Cannot delete the default system plan.' };
    }

    const teamsUsingPlan = await db.query.teams.findFirst({
      where: eq(teams.planId, planId)
    });

    if (teamsUsingPlan) {
      return { error: 'Cannot delete this plan because it is assigned to one or more teams.' };
    }

    const plan = await db.query.plans.findFirst({ where: eq(plans.id, planId) });
    if (plan?.gatewayId && plan?.gatewayProductId) {
      try {
        const gw = await db.query.paymentGateways.findFirst({ where: eq(paymentGateways.id, plan.gatewayId) });
        if (gw?.gateway === 'stripe') {
          const adapter = new StripeAdapter(gw.secretKey);
          await adapter.stripeClient.products.update(plan.gatewayProductId, { active: false });
        }
      } catch (e) {
        console.error(e);
      }
    }

    await db.delete(plans).where(eq(plans.id, planId));
    revalidatePath('/admin/plans');
    return { success: 'Plan deleted successfully' };
  } catch (error: any) {
    return { error: error.message || 'Failed to delete plan' };
  }
}