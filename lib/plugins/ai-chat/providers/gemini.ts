import { GoogleGenAI, Type } from "@google/genai";
import { AIProvider, AIProviderConfig, AIMessage, ToolDefinition } from "../types";
import fs from 'fs/promises';
import path from 'path';

export class GeminiProvider implements AIProvider {
  private client: GoogleGenAI;
  private modelName: string;
  private systemPrompt?: string;
  private config: any;
  private attachments: { name: string; url: string; type: string; size: number }[];

  constructor(config: AIProviderConfig) {
    this.client = new GoogleGenAI({ apiKey: config.apiKey });
    this.modelName = config.model;
    this.attachments = config.attachments || [];
    
    const audioInstruction = "IMPORTANT: You have multimodal capabilities. When you receive an AUDIO file, you must LISTEN to it and extract the user's intent. If the user asks for something in the audio (like a menu, catalog, or action), CALL THE APPROPRIATE TOOL immediately. Do not ask for transcription.";
    
    this.systemPrompt = config.systemPrompt 
        ? `${config.systemPrompt}\n\n${audioInstruction}` 
        : audioInstruction;

    this.config = {
        temperature: config.temperature ?? 0.7,
        maxOutputTokens: config.maxOutputTokens ?? 1000,
    };
  }

  private async getFileContent(url: string): Promise<{ data: string, mimeType: string } | null> {
    try {
        let fileData: string;
        let mimeType = 'application/octet-stream';

        if (url.startsWith('http') || url.startsWith('https')) {
            const fetchRes = await fetch(url);
            const arrayBuffer = await fetchRes.arrayBuffer();
            fileData = Buffer.from(arrayBuffer).toString('base64');
            mimeType = fetchRes.headers.get('content-type') || mimeType;
        } else {
            const cleanPath = url.replace(/\\/g, '/');
            const filePath = path.join(process.cwd(), 'public', cleanPath.startsWith('/') ? cleanPath.slice(1) : cleanPath);
            const fileBuffer = await fs.readFile(filePath);
            fileData = fileBuffer.toString('base64');
            
            if (cleanPath.endsWith('.pdf')) mimeType = 'application/pdf';
            else if (cleanPath.endsWith('.png')) mimeType = 'image/png';
            else if (cleanPath.endsWith('.jpg') || cleanPath.endsWith('.jpeg')) mimeType = 'image/jpeg';
            else if (cleanPath.endsWith('.txt')) mimeType = 'text/plain';
            else if (cleanPath.endsWith('.md')) mimeType = 'text/markdown';
            else if (cleanPath.endsWith('.csv')) mimeType = 'text/csv';
            else if (cleanPath.endsWith('.ogg')) mimeType = 'audio/ogg';
            else if (cleanPath.endsWith('.wav')) mimeType = 'audio/wav';
            else if (cleanPath.endsWith('.mp3')) mimeType = 'audio/mp3';
            else if (cleanPath.endsWith('.mp4')) mimeType = 'video/mp4';
        }
        return { data: fileData, mimeType };
    } catch (e) {
        return null;
    }
  }

  private async mapMessagesToGemini(messages: AIMessage[]): Promise<any[]> {
    const contents: any[] = [];

    for (const msg of messages) {
        if (msg.role === 'system') continue;

        const parts: any[] = [];

        if (msg.content) {
          parts.push({ text: msg.content });
        }

        if (msg.audioUrl) {
            const audio = await this.getFileContent(msg.audioUrl);
            if (audio) {
                parts.push({
                    inlineData: {
                        mimeType: audio.mimeType,
                        data: audio.data
                    }
                });
            }
        }

        if (msg.toolCalls && msg.toolCalls.length > 0) {
          msg.toolCalls.forEach(call => {
            parts.push({
              functionCall: {
                name: call.function.name,
                args: JSON.parse(call.function.arguments)
              }
            });
          });
        }

        if (msg.role === 'tool' && msg.toolCallId && msg.content) {
           const lastContent = contents[contents.length - 1];
           const lastWasModelWithCall = lastContent && 
                                        lastContent.role === 'model' && 
                                        lastContent.parts?.some((p: any) => !!p.functionCall);

           if (!lastWasModelWithCall) {
               continue; 
           }

           contents.push({
             role: 'tool', 
             parts: [{
               functionResponse: {
                 name: msg.toolCallId,
                 response: { result: msg.content } 
               }
             }]
           });
           continue; 
        }

        if (parts.length === 0) continue;

        contents.push({
          role: msg.role === 'assistant' ? 'model' : 'user',
          parts: parts
        });
    }

    return contents;
  }

  private mapToolsToGemini(tools?: ToolDefinition[]): any[] | undefined {
    if (!tools || tools.length === 0) return undefined;
    
    const functionDeclarations = tools.map(tool => ({
      name: tool.name,
      description: tool.description,
      parameters: {
        type: Type.OBJECT,
        properties: tool.parameters.properties as any,
        required: tool.parameters.required
      }
    }));

    return [{ functionDeclarations }];
  }

  async generateResponse(messages: AIMessage[], tools?: ToolDefinition[]): Promise<AIMessage> {
    const geminiTools = this.mapToolsToGemini(tools);
    const history = await this.mapMessagesToGemini(messages);

    const systemParts: any[] = [{ text: this.systemPrompt || "" }];
    const knowledgeBaseMediaParts: any[] = [];
    
    if (this.attachments.length > 0) {
        for (const att of this.attachments) {
            const file = await this.getFileContent(att.url);
            if (file) {
                if(att.type.startsWith('text/') || att.name.endsWith('.txt') || att.name.endsWith('.md') || att.name.endsWith('.csv')) {
                    const textContent = Buffer.from(file.data, 'base64').toString('utf-8');
                    systemParts.push({ text: `\n\n--- Attached Knowledge Base File: ${att.name} ---\n${textContent}\n--- End File ---` });
                } else {
                    knowledgeBaseMediaParts.push({
                        inlineData: {
                            mimeType: file.mimeType || att.type,
                            data: file.data
                        }
                    });
                }
            }
        }
    }

    if (knowledgeBaseMediaParts.length > 0) {
        if (history.length > 0 && history[0].role === 'user') {
            history[0].parts = [...knowledgeBaseMediaParts, ...history[0].parts];
        } else {
            history.unshift({
                role: 'user',
                parts: [...knowledgeBaseMediaParts, { text: "Use the files above as context for our conversation." }]
            });
        }
    }

    if (history.length === 0) {
        history.push({ role: 'user', parts: [{ text: "Hello" }] });
    }

    try {
        const response = await this.client.models.generateContent({
            model: this.modelName,
            contents: history,
            config: {
                ...this.config,
                systemInstruction: { parts: systemParts, role: 'system' },
                tools: geminiTools,
            }
        });

        const candidate = response.candidates?.[0];
        const contentParts = candidate?.content?.parts;
        
        let text = "";
        let toolCalls = undefined;

        if (contentParts) {
            const textPart = contentParts.find(p => p.text);
            if (textPart) text = textPart.text || "";

            const functionCallParts = contentParts.filter(p => p.functionCall);
            if (functionCallParts.length > 0) {
                toolCalls = functionCallParts.map(p => ({
                    id: p.functionCall?.name || 'unknown_call_id',
                    type: 'function',
                    function: {
                        name: p.functionCall?.name || '',
                        arguments: JSON.stringify(p.functionCall?.args || {})
                    }
                }));
            }
        }

        return {
            role: 'assistant',
            content: text || null,
            toolCalls: toolCalls
        };

    } catch (error) {
        console.error(error);
        throw error;
    }
  }

  async transcribeAudio(audioUrl: string): Promise<string> {
    return "Audio content"; 
  }
}