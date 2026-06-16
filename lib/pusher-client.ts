import PusherClient from 'pusher-js';

declare global {
  var __pusherClient: PusherClient | undefined;
}

export function getPusherClient(): PusherClient | null {
  const key = process.env.NEXT_PUBLIC_PUSHER_KEY;
  const cluster = process.env.NEXT_PUBLIC_PUSHER_CLUSTER;

  if (!key || !cluster) return null;

  if (!globalThis.__pusherClient) {
    globalThis.__pusherClient = new PusherClient(key, {
      cluster,
      forceTLS: true,
    });
  }

  return globalThis.__pusherClient;
}

export function getTeamChannel(teamId: number) {
  const client = getPusherClient();
  if (!client) return null;

  const channelName = `team-${teamId}`;
  return (client as any).channel?.(channelName) || client.subscribe(channelName);
}
