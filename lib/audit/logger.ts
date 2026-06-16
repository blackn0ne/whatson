import { db } from '@/lib/db/drizzle';
import { executionLogs } from '@/lib/db/schema';

const MAX_DATA_SIZE = 2048;
const FLUSH_INTERVAL = 2000;
const FLUSH_THRESHOLD = 50;

type LogEntry = typeof executionLogs.$inferInsert;

let buffer: LogEntry[] = [];
let flushTimer: ReturnType<typeof setInterval> | null = null;

function truncate(data: any, maxSize = MAX_DATA_SIZE): any {
  if (!data) return null;
  const str = typeof data === 'string' ? data : JSON.stringify(data);
  if (str.length <= maxSize) return data;
  if (typeof data === 'string') return data.substring(0, maxSize);
  return JSON.parse(str.substring(0, maxSize - 1) + '}') || { _truncated: true, preview: str.substring(0, 500) };
}

function safeTruncate(data: any): any {
  if (!data) return null;
  try {
    return truncate(data);
  } catch {
    return { _truncated: true };
  }
}

async function flush() {
  if (buffer.length === 0) return;
  const batch = buffer.splice(0);
  try {
    await db.insert(executionLogs).values(batch);
  } catch (err: any) {
    console.warn('[AuditLog] Flush failed:', err.message);
  }
}

function enqueue(entry: LogEntry) {
  buffer.push(entry);
  if (buffer.length >= FLUSH_THRESHOLD) {
    flush();
  }
  if (!flushTimer) {
    flushTimer = setInterval(() => {
      flush();
      if (buffer.length === 0 && flushTimer) {
        clearInterval(flushTimer);
        flushTimer = null;
      }
    }, FLUSH_INTERVAL);
  }
}

interface BaseLogParams {
  teamId: number;
  chatId: number;
  messageId?: string;
}

export function logAutomationNode(params: BaseLogParams & {
  automationId?: number;
  sessionId?: number;
  nodeId: string;
  nodeType: string;
  input?: any;
  output?: any;
  variables?: Record<string, any>;
  durationMs?: number;
  status?: 'success' | 'error' | 'skipped';
  error?: string;
}) {
  enqueue({
    teamId: params.teamId,
    chatId: params.chatId,
    messageId: params.messageId || null,
    source: 'automation',
    eventType: 'node_executed',
    automationId: params.automationId || null,
    automationSessionId: params.sessionId || null,
    nodeId: params.nodeId,
    nodeType: params.nodeType,
    inputData: safeTruncate(params.input),
    outputData: safeTruncate(params.output),
    metadata: safeTruncate(params.variables ? { variables: params.variables } : null),
    durationMs: params.durationMs || null,
    status: params.status || 'success',
    errorMessage: params.error || null,
  });
}

export function logAutomationSession(params: BaseLogParams & {
  automationId: number;
  sessionId: number;
  eventType: 'session_started' | 'session_completed';
  metadata?: any;
}) {
  enqueue({
    teamId: params.teamId,
    chatId: params.chatId,
    messageId: params.messageId || null,
    source: 'automation',
    eventType: params.eventType,
    automationId: params.automationId,
    automationSessionId: params.sessionId,
    nodeId: null,
    nodeType: null,
    inputData: null,
    outputData: null,
    metadata: safeTruncate(params.metadata),
    durationMs: null,
    status: 'success',
    errorMessage: null,
  });
}

export function logAIInteraction(params: BaseLogParams & {
  eventType: 'ai_request' | 'ai_response' | 'ai_tool_call' | 'ai_handover' | 'ai_response_sent';
  input?: any;
  output?: any;
  metadata?: any;
  durationMs?: number;
  status?: 'success' | 'error';
  error?: string;
}) {
  enqueue({
    teamId: params.teamId,
    chatId: params.chatId,
    messageId: params.messageId || null,
    source: 'ai',
    eventType: params.eventType,
    automationId: null,
    automationSessionId: null,
    nodeId: null,
    nodeType: null,
    inputData: safeTruncate(params.input),
    outputData: safeTruncate(params.output),
    metadata: safeTruncate(params.metadata),
    durationMs: params.durationMs || null,
    status: params.status || 'success',
    errorMessage: params.error || null,
  });
}

export function logCRMAction(params: BaseLogParams & {
  eventType: 'agent_assigned' | 'funnel_changed' | 'tag_added' | 'department_assigned';
  source?: 'automation' | 'ai' | 'system';
  automationId?: number;
  sessionId?: number;
  metadata?: any;
}) {
  enqueue({
    teamId: params.teamId,
    chatId: params.chatId,
    messageId: params.messageId || null,
    source: params.source || 'system',
    eventType: params.eventType,
    automationId: params.automationId || null,
    automationSessionId: params.sessionId || null,
    nodeId: null,
    nodeType: null,
    inputData: null,
    outputData: null,
    metadata: safeTruncate(params.metadata),
    durationMs: null,
    status: 'success',
    errorMessage: null,
  });
}
