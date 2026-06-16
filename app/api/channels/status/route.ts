import { NextResponse } from 'next/server';
import { getUser } from '@/lib/db/queries';
import { isChannelActive } from '@/lib/whatsapp/config';
import { isPluginInstalled } from '@/lib/plugins/registry';
import { db } from '@/lib/db/drizzle';
import { channelConfigs } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';

export async function GET() {
  try {
    const user = await getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const evoActive = await isChannelActive('evolution');
    const metaActive = await isChannelActive('meta-cloud');
    const metaPlugin = isPluginInstalled('meta-cloud');

    
    let metaAppId = '';
    if (metaActive && metaPlugin) {
      const [row] = await db.select({ metaAppId: channelConfigs.metaAppId, metaConfigId: channelConfigs.metaConfigId })
        .from(channelConfigs)
        .where(eq(channelConfigs.channel, 'meta-cloud'))
        .limit(1);
      metaAppId = row?.metaAppId || process.env.NEXT_PUBLIC_META_APP_ID || '';
    }

    return NextResponse.json({
      evolution: { active: evoActive },
      metaCloud: { active: metaActive && metaPlugin, appId: metaAppId },
    });
  } catch (error: any) {
    console.error('[Channels Status]', error.message);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
