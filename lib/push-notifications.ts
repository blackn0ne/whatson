import { db } from '@/lib/db/drizzle';
import { pushTokens, teamMembers } from '@/lib/db/schema';
import { eq, and, inArray } from 'drizzle-orm';

interface ExpoPushMessage {
  to: string;
  title: string;
  body: string;
  data?: Record<string, any>;
  sound: 'default';
  priority: 'high';
  channelId?: string;
}

interface ExpoPushTicket {
  status: 'ok' | 'error';
  id?: string;
  message?: string;
  details?: {
    error?: 'DeviceNotRegistered' | 'InvalidCredentials' | 'MessageTooBig' | 'MessageRateExceeded';
  };
}



export async function sendPushNotification(
  userId: number,
  title: string,
  body: string,
  data?: Record<string, any>
): Promise<void> {
  try {
    const tokens = await db
      .select({ id: pushTokens.id, token: pushTokens.token })
      .from(pushTokens)
      .where(eq(pushTokens.userId, userId));

    if (tokens.length === 0) return;

    const messages: ExpoPushMessage[] = tokens.map((t) => ({
      to: t.token,
      title,
      body,
      data: data || {},
      sound: 'default' as const,
      priority: 'high' as const,
      channelId: 'messages',
    }));

    const response = await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Accept-Encoding': 'gzip, deflate',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(messages),
    });

    if (!response.ok) {
      console.error('[Push Notification] Expo API error:', response.status, await response.text());
      return;
    }

    const result = await response.json();
    const tickets: ExpoPushTicket[] = result.data || [];

    
    const tokensToDelete: number[] = [];

    for (let i = 0; i < tickets.length; i++) {
      const ticket = tickets[i];
      if (
        ticket.status === 'error' &&
        ticket.details?.error === 'DeviceNotRegistered'
      ) {
        tokensToDelete.push(tokens[i].id);
      }
    }

    if (tokensToDelete.length > 0) {
      await db
        .delete(pushTokens)
        .where(inArray(pushTokens.id, tokensToDelete));
    }
  } catch (error: any) {
    console.error('[Push Notification] Error sending notification:', error.message);
  }
}



export async function sendPushToTeam(
  teamId: number,
  excludeUserId: number,
  title: string,
  body: string,
  data?: Record<string, any>
): Promise<void> {
  try {
    
    const members = await db
      .select({ userId: teamMembers.userId })
      .from(teamMembers)
      .where(eq(teamMembers.teamId, teamId));

    const userIds = members
      .map((m) => m.userId)
      .filter((id) => id !== excludeUserId);

    if (userIds.length === 0) return;

    
    const tokens = await db
      .select({ id: pushTokens.id, token: pushTokens.token })
      .from(pushTokens)
      .where(inArray(pushTokens.userId, userIds));

    if (tokens.length === 0) return;

    const messages: ExpoPushMessage[] = tokens.map((t) => ({
      to: t.token,
      title,
      body,
      data: data || {},
      sound: 'default' as const,
      priority: 'high' as const,
      channelId: 'messages',
    }));

    const response = await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Accept-Encoding': 'gzip, deflate',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(messages),
    });

    if (!response.ok) {
      console.error('[Push Notification] Expo API error:', response.status, await response.text());
      return;
    }

    const result = await response.json();
    const tickets: ExpoPushTicket[] = result.data || [];

    
    const tokensToDelete: number[] = [];

    for (let i = 0; i < tickets.length; i++) {
      const ticket = tickets[i];
      if (
        ticket.status === 'error' &&
        ticket.details?.error === 'DeviceNotRegistered'
      ) {
        tokensToDelete.push(tokens[i].id);
      }
    }

    if (tokensToDelete.length > 0) {
      await db
        .delete(pushTokens)
        .where(inArray(pushTokens.id, tokensToDelete));
    }
  } catch (error: any) {
    console.error('[Push Notification] Error sending team notification:', error.message);
  }
}
