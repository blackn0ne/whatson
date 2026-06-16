import { NextResponse } from 'next/server';
import { getTeamForUser, getUser } from '@/lib/db/queries';
import { db } from '@/lib/db/drizzle';
import { evolutionInstances, ActivityType } from '@/lib/db/schema';
import { logActivity } from '@/lib/db/activity';
import { enforceLimit } from '@/lib/limits';
import { isChannelActive, getEvolutionConfig } from '@/lib/whatsapp/config';

const WEBHOOK_EVENTS = [
  "MESSAGES_UPSERT", "MESSAGES_UPDATE", "CHATS_UPDATE",
  "CONNECTION_UPDATE", "QRCODE_UPDATED", "CONTACTS_UPDATE"
];

export async function POST(request: Request) {
  try {
    const { 
      instanceName, 
      number, 
      integration = "WHATSAPP-BAILEYS",
      metaToken, 
      metaBusinessId,
      metaPhoneNumberId,
      rejectCalls,
      ignoreGroups,
      alwaysOnline,
      readMessages,
      readStatus
    } = await request.json();

    const evoConfig = await getEvolutionConfig();
    const MASTER_API_KEY = evoConfig.apiKey;
    const YOUR_PUBLIC_WEBHOOK_URL = evoConfig.webhookUrl;
    const EVOLUTION_API_URL = evoConfig.apiUrl;

    if (!MASTER_API_KEY) {
        throw new Error("AUTHENTICATION_API_KEY is not configured on the server.");
    }
    if (!YOUR_PUBLIC_WEBHOOK_URL) {
        throw new Error("Webhook URL (NEXT_PUBLIC_WEBHOOK_URL) is not defined.");
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

    
    const channelType = integration === 'WHATSAPP-BUSINESS' ? 'evolution' : 'evolution';
    if (!(await isChannelActive(channelType as any))) {
      return NextResponse.json({ error: 'This channel is disabled by the administrator.' }, { status: 403 });
    }

    let createData: any = {};

    
    const slug = `t${team.id}_${Date.now().toString(36)}`;
    const evoInstanceName = instanceName ? `${slug}_${instanceName.replace(/[^a-zA-Z0-9_-]/g, '')}` : slug;
    const userDisplayName = instanceName || `Instance ${slug}`;

    console.log(`Starting instance setup: ${evoInstanceName} (display: ${userDisplayName}) [${integration}]`);

    let evolutionPayload: any = {
      instanceName: evoInstanceName,
      integration: integration,
      qrcode: integration === "WHATSAPP-BAILEYS",
      webhook: { 
        url: YOUR_PUBLIC_WEBHOOK_URL,
        byEvents: false,
        base64: true,
        events: WEBHOOK_EVENTS,
      }
    };

    if (integration === "WHATSAPP-BUSINESS") {
      evolutionPayload = {
        ...evolutionPayload,
        token: metaToken,
        number: metaPhoneNumberId, 
        businessId: metaBusinessId,
      };
    } else {
      evolutionPayload = {
        ...evolutionPayload,
        number: number,
        rejectCalls: rejectCalls,
        ignoreGroups: ignoreGroups,
        alwaysOnline: alwaysOnline,
        readMessages: readMessages,
        readStatus: readStatus,
      };
    }

    const createResponse = await fetch(
      `${EVOLUTION_API_URL}/instance/create`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': MASTER_API_KEY,
        },
        body: JSON.stringify(evolutionPayload),
        signal: AbortSignal.timeout(10000),
      }
    );

    createData = await createResponse.json();

    if (!createResponse.ok) {
        const errorMsg = createData.response?.message?.[0] || createData.message || 'Unknown API failure.';
        const errorString = JSON.stringify(createData);

        if (errorString.includes("already exists") || createResponse.status === 403) {
            
            const existingInstanceResponse = await fetch(
                `${EVOLUTION_API_URL}/instance/fetchInstances?instanceName=${evoInstanceName}`,
                {
                    headers: { 'apikey': MASTER_API_KEY },
                    cache: 'no-store',
                    signal: AbortSignal.timeout(10000),
                }
            );

            if (existingInstanceResponse.ok) {
                const existingData = await existingInstanceResponse.json();
                
                const foundInstance = Array.isArray(existingData) 
                    ? existingData.find((i: any) => i.instance.instanceName === evoInstanceName)
                    : existingData;

                if (foundInstance) {
                     createData = foundInstance; 
                } else { 
                    throw new Error(`Instance ${evoInstanceName} exists but was not found in the list.`);
                }
            } else { 
                throw new Error(`Failed to fetch existing instance data for ${evoInstanceName}. Check if API Key is correct.`);
            }
        } else {
            console.error("Fatal error creating instance:", createData);
            return NextResponse.json({ error: errorMsg }, { status: 500 });
        }
    }

    const instanceId = createData.instance?.instanceId || createData.instance?.id;
    const instanceToken = createData.hash || createData.token;

    if (!instanceId) { 
        console.error("Data received from Evolution:", JSON.stringify(createData, null, 2));
        throw new Error("Could not obtain instanceId from Evolution API.");
    }

    let qrData = null;

    if (integration === "WHATSAPP-BAILEYS") {
      const connectResponse = await fetch(
        `${EVOLUTION_API_URL}/instance/connect/${evoInstanceName}`,
        {
          method: 'GET',
          headers: { 'apikey': MASTER_API_KEY },
          cache: 'no-store',
          signal: AbortSignal.timeout(10000),
        }
      );

      if (!connectResponse.ok) {
          const error = await connectResponse.json();
          console.error("Failed to GET QR Code:", error);
          return NextResponse.json({ error: 'Failed to fetch QR Code. Check if the instance is already connected.' }, { status: 500 });
      }

      qrData = await connectResponse.json();
    }

    await db.insert(evolutionInstances)
      .values({
        teamId: team.id,
        instanceName: evoInstanceName,
        displayName: userDisplayName,
        instanceNumber: integration === "WHATSAPP-BUSINESS" ? metaPhoneNumberId : number,
        evolutionInstanceId: instanceId,
        accessToken: instanceToken,
        integration: integration,
        metaBusinessId: metaBusinessId || null,
        metaPhoneNumberId: metaPhoneNumberId || null,
        metaToken: metaToken || null,
      })
      .onConflictDoUpdate({
        target: [evolutionInstances.teamId, evolutionInstances.instanceName],
        set: {
          instanceNumber: integration === "WHATSAPP-BUSINESS" ? metaPhoneNumberId : number,
          evolutionInstanceId: instanceId,
          accessToken: instanceToken,
          integration: integration,
          metaBusinessId: metaBusinessId || null,
          metaPhoneNumberId: metaPhoneNumberId || null,
          metaToken: metaToken || null,
          updatedAt: new Date(),
        }
      });

    await logActivity(team.id, user.id, ActivityType.CREATE_INSTANCE);

    return NextResponse.json({
      instance: createData.instance,
      hash: instanceToken,
      type: integration,     
      qrcode: qrData ? {                   
        pairingCode: qrData.pairingCode,
        code: qrData.code,
        base64: qrData.base64,
        count: qrData.count
      } : null
    });

  } catch (error: any) {
    console.error('Fatal error in instance setup:', error.message);
    console.error('[Instance Setup]', error.message);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}