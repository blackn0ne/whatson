import { NextResponse } from 'next/server';
import { getTeamForUser, getUser } from '@/lib/db/queries';
import { db } from '@/lib/db/drizzle';
import { evolutionInstances, ActivityType } from '@/lib/db/schema';
import { logActivity } from '@/lib/db/activity';
import { enforceLimit } from '@/lib/limits';
import { isPluginInstalled } from '@/lib/plugins/registry';
import { isChannelActive, getMetaCloudConfig } from '@/lib/whatsapp/config';

const GRAPH_API_URL = 'https://graph.facebook.com';
const GRAPH_API_VERSION = 'v21.0';

export async function POST(request: Request) {
  try {
    if (!isPluginInstalled('meta-cloud')) {
      return NextResponse.json({ error: 'Meta Cloud plugin is not installed' }, { status: 400 });
    }

    if (!(await isChannelActive('meta-cloud'))) {
      return NextResponse.json({ error: 'Meta Cloud channel is disabled by the administrator.' }, { status: 403 });
    }

    const user = await getUser();
    const team = await getTeamForUser();
    if (!team || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
      await enforceLimit(team.id, 'instances');
    } catch (e: any) {
      return NextResponse.json({ error: e.message }, { status: 403 });
    }

    const { exchangeToken, instanceName } = await request.json();

    if (!exchangeToken) {
      return NextResponse.json({ error: 'Exchange token is required' }, { status: 400 });
    }

    
    const metaConfig = await getMetaCloudConfig();
    const META_APP_ID = metaConfig.appId;
    const META_APP_SECRET = metaConfig.appSecret;

    if (!META_APP_ID || !META_APP_SECRET) {
      console.error('[Meta Signup] META_APP_ID or META_APP_SECRET not configured');
      return NextResponse.json({ error: 'Meta app configuration is missing on the server' }, { status: 500 });
    }

    
    const tokenResponse = await fetch(
      `${GRAPH_API_URL}/${GRAPH_API_VERSION}/oauth/access_token?` +
      `grant_type=fb_exchange_token&` +
      `client_id=${META_APP_ID}&` +
      `client_secret=${META_APP_SECRET}&` +
      `fb_exchange_token=${exchangeToken}`,
      { signal: AbortSignal.timeout(15000) }
    );

    const tokenData = await tokenResponse.json();
    if (!tokenResponse.ok || !tokenData.access_token) {
      console.error('[Meta Signup] Token exchange failed:', tokenData);
      return NextResponse.json({ error: 'Failed to exchange token with Meta' }, { status: 400 });
    }

    const accessToken = tokenData.access_token;

    
    
    
    const sharedWabasResponse = await fetch(
      `${GRAPH_API_URL}/${GRAPH_API_VERSION}/debug_token?input_token=${accessToken}`,
      {
        headers: { 'Authorization': `Bearer ${accessToken}` },
        signal: AbortSignal.timeout(10000),
      }
    );

    const debugData = await sharedWabasResponse.json();
    const granularScopes = debugData?.data?.granular_scopes || [];

    
    const wabaScope = granularScopes.find((s: any) => s.scope === 'whatsapp_business_management');
    const wabaIds = wabaScope?.target_ids || [];

    if (wabaIds.length === 0) {
      return NextResponse.json({ error: 'No WhatsApp Business Account was shared during signup' }, { status: 400 });
    }

    const wabaId = wabaIds[0];

    
    const phonesResponse = await fetch(
      `${GRAPH_API_URL}/${GRAPH_API_VERSION}/${wabaId}/phone_numbers?fields=display_phone_number,verified_name,quality_rating,id`,
      {
        headers: { 'Authorization': `Bearer ${accessToken}` },
        signal: AbortSignal.timeout(10000),
      }
    );

    const phonesData = await phonesResponse.json();
    const phoneNumbers = phonesData?.data || [];

    if (phoneNumbers.length === 0) {
      return NextResponse.json({ error: 'No phone numbers found on the shared WABA' }, { status: 400 });
    }

    const phone = phoneNumbers[0];
    const phoneNumberId = phone.id;
    const displayPhoneNumber = phone.display_phone_number;
    const verifiedName = phone.verified_name;

    
    const wabaResponse = await fetch(
      `${GRAPH_API_URL}/${GRAPH_API_VERSION}/${wabaId}?fields=business_verification_status,on_behalf_of_business_info`,
      {
        headers: { 'Authorization': `Bearer ${accessToken}` },
        signal: AbortSignal.timeout(10000),
      }
    );

    const wabaDetails = await wabaResponse.json();
    const businessId = wabaDetails?.on_behalf_of_business_info?.id || '';

    const webhookUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.NEXTAUTH_URL;
    if (webhookUrl) {
      await fetch(
        `${GRAPH_API_URL}/${GRAPH_API_VERSION}/${wabaId}/subscribed_apps`,
        {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${accessToken}` },
          signal: AbortSignal.timeout(10000),
        }
      ).catch((e) => console.error('[Meta Signup] Webhook subscription failed:', e));
    }

    
    const slug = `t${team.id}_${Date.now().toString(36)}`;
    const sanitizedName = (instanceName || verifiedName || 'meta').replace(/[^a-zA-Z0-9_-]/g, '');
    const evoInstanceName = `${slug}_${sanitizedName}`;
    const userDisplayName = instanceName || verifiedName || `Meta ${displayPhoneNumber}`;

    const [newInstance] = await db.insert(evolutionInstances)
      .values({
        teamId: team.id,
        instanceName: evoInstanceName,
        displayName: userDisplayName,
        instanceNumber: displayPhoneNumber,
        integration: 'META-CLOUD',
        metaToken: accessToken,
        metaPhoneNumberId: phoneNumberId,
        metaBusinessId: businessId,
        metaWabaId: wabaId,
        metaAppId: META_APP_ID,
        accessToken: accessToken,
      })
      .returning();

    await logActivity(team.id, user.id, ActivityType.CREATE_INSTANCE);

    return NextResponse.json({
      success: true,
      instance: {
        id: newInstance.id,
        name: userDisplayName,
        phoneNumber: displayPhoneNumber,
        verifiedName: verifiedName,
        integration: 'META-CLOUD',
      },
    });

  } catch (error: any) {
    console.error('[Meta Signup] Fatal error:', error.message);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
