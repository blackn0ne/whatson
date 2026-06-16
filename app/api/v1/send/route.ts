import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db/drizzle";
import { evolutionInstances, chats, messages } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { getAuthenticatedTeam } from "@/lib/auth/api";
import { z } from "zod";

const sendSchema = z.object({
  instanceName: z.string().min(1),
  number: z.string().min(1),
  type: z.enum(["text", "image", "video", "document", "audio"]),
  message: z.string().optional(),
  mediaUrl: z.string().url().optional(),
  fileName: z.string().optional(),
  mimetype: z.string().optional(),
});

export async function POST(req: NextRequest) {
  try {
    const team = await getAuthenticatedTeam(req);

    if (!team) {
      return NextResponse.json(
        { error: "Unauthorized. Invalid or missing API Token." },
        { status: 401 }
      );
    }

    const body = await req.json();
    const validation = sendSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { error: "Invalid payload", details: validation.error.format() },
        { status: 400 }
      );
    }

    const { instanceName, number, type, message, mediaUrl, fileName, mimetype } = validation.data;

    const instance = await db.query.evolutionInstances.findFirst({
      where: and(
        eq(evolutionInstances.teamId, team.id),
        eq(evolutionInstances.instanceName, instanceName)
      ),
    });

    if (!instance || !instance.instanceName || !instance.accessToken) {
      return NextResponse.json(
        { error: "Instance not found, inactive, or missing access token" },
        { status: 404 }
      );
    }

    const evolutionUrl = process.env.EVOLUTION_API_URL!;
    const instanceToken = instance.accessToken;
    const formattedNumber = number.replace(/\D/g, "");
    const remoteJid = `${formattedNumber}@s.whatsapp.net`;
    
    let responseData;
    let messageTypeForDb = "conversation"; 

    if (type === "text") {
      if (!message) {
        return NextResponse.json({ error: "Message is required for type 'text'" }, { status: 400 });
      }

      const res = await fetch(`${evolutionUrl}/message/sendText/${instance.instanceName}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "apikey": instanceToken,
        },
        body: JSON.stringify({
          number: formattedNumber,
          text: message,
        }),
      });

      if (!res.ok) {
         const err = await res.json();
         throw new Error(err?.message || "Failed to send text message");
      }
      responseData = await res.json();
      messageTypeForDb = "conversation";

    } else if (type === "audio") {
      if (!mediaUrl) {
        return NextResponse.json({ error: "mediaUrl is required for type 'audio'" }, { status: 400 });
      }

      const res = await fetch(`${evolutionUrl}/message/sendWhatsAppAudio/${instance.instanceName}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "apikey": instanceToken,
        },
        body: JSON.stringify({
          number: formattedNumber,
          audio: mediaUrl, 
        }),
      });

      if (!res.ok) {
         const err = await res.json();
         throw new Error(err?.message || "Failed to send audio");
      }
      responseData = await res.json();
      messageTypeForDb = "audioMessage";

    } else {
      if (!mediaUrl) {
        return NextResponse.json({ error: "mediaUrl is required for media types" }, { status: 400 });
      }

      const mediaPayload = {
        number: formattedNumber,
        mediatype: type,
        mimetype: mimetype, 
        caption: message || "",
        media: mediaUrl, 
        fileName: fileName || "file",
      };

      const res = await fetch(`${evolutionUrl}/message/sendMedia/${instance.instanceName}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "apikey": instanceToken,
        },
        body: JSON.stringify(mediaPayload),
      });

      if (!res.ok) {
         const err = await res.json();
         throw new Error(err?.message || "Failed to send media");
      }
      responseData = await res.json();
      
      if (type === "image") messageTypeForDb = "imageMessage";
      else if (type === "video") messageTypeForDb = "videoMessage";
      else if (type === "document") messageTypeForDb = "documentMessage";
    }

    if (responseData && responseData.key && responseData.key.id) {
        let chat = await db.query.chats.findFirst({
            where: and(
                eq(chats.remoteJid, remoteJid),
                eq(chats.instanceId, instance.id)
            )
        });

        let chatId: number;

        if (!chat) {
            const [newChat] = await db.insert(chats).values({
                teamId: team.id,
                remoteJid: remoteJid,
                instanceId: instance.id,
                name: formattedNumber
            }).returning();
            chatId = newChat.id;
        } else {
            chatId = chat.id;
        }

        await db.insert(messages).values({
            id: responseData.key.id,
            chatId: chatId,
            fromMe: true,
            messageType: messageTypeForDb,
            text: message || null,
            mediaUrl: mediaUrl || null,
            mediaMimetype: mimetype || null,
            mediaCaption: (type !== 'text' && message) ? message : null,
            timestamp: new Date(),
            status: "sent"
        });
    }

    return NextResponse.json({ success: true, data: responseData });

  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { 
        error: "Internal Server Error", 
        details: error instanceof Error ? error.message : "Unknown error" 
      },
      { status: 500 }
    );
  }
}