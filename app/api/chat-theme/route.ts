import { NextResponse } from 'next/server';
import { getChatTheme } from '@/lib/db/queries/chat-theme';

export async function GET() {
  const theme = await getChatTheme();

  if (!theme) {
    return NextResponse.json({
      backgroundType: 'solid',
      backgroundColor: '#F4F4F5',
      backgroundImageUrl: null,
      userBubbleColor: '#E2EDE4',
      contactBubbleColor: '#FFFFFF',
      darkBackgroundColor: '#27272A',
      darkUserBubbleColor: '#2A352E',
      darkContactBubbleColor: '#18181B',
    });
  }

  return NextResponse.json(theme);
}
