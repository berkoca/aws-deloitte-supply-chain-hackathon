import {
  BedrockAgentCoreClient,
  CreateEventCommand,
  ListEventsCommand,
  RetrieveMemoryRecordsCommand,
} from '@aws-sdk/client-bedrock-agentcore';
import type { ConstraintMemory, ConstraintRecord } from './memory.types.js';

/**
 * Amazon Bedrock AgentCore Memory.
 * - Kısa süreli: her red bir event olarak oturuma yazılır (CreateEvent / ListEvents).
 * - Uzun süreli: hafızada semantik strateji varsa kayıtlar namespace altında çıkarılır (RetrieveMemoryRecords).
 */
export class AgentCoreConstraintMemory implements ConstraintMemory {
  readonly kind = 'agentcore' as const;
  private client: BedrockAgentCoreClient;
  constructor(
    private memoryId: string,
    region: string,
    private actorId = 'pinar-et-planlama',
    private namespace?: string,
  ) {
    this.client = new BedrockAgentCoreClient({ region });
  }

  async save(sessionId: string, rec: ConstraintRecord) {
    const text = `Yönetici "${rec.flag}" aksiyonunu reddetti${rec.shock ? ` (${rec.shock} şoku)` : ''}. Gerekçe: ${rec.reason}`;
    await this.client.send(
      new CreateEventCommand({
        memoryId: this.memoryId,
        actorId: this.actorId,
        sessionId,
        eventTimestamp: new Date(),
        payload: [{ conversational: { role: 'USER', content: { text } } }],
        // metadata yalnızca ASCII kabul ediyor; Türkçe gerekçe metnin içinde
        metadata: { flag: { stringValue: rec.flag }, ...(rec.shock ? { shock: { stringValue: rec.shock } } : {}) },
      }),
    );
  }

  async list(sessionId: string) {
    const out = await this.client.send(
      new ListEventsCommand({ memoryId: this.memoryId, actorId: this.actorId, sessionId, includePayloads: true, maxResults: 50 }),
    );
    return (out.events || []).map((e) => ({
      flag: e.metadata?.flag?.stringValue || '',
      reason: (((e.payload?.[0] as any)?.conversational?.content?.text || '') as string).split('Gerekçe: ').pop() || '',
      shock: e.metadata?.shock?.stringValue,
      ts: e.eventTimestamp?.toISOString(),
    }));
  }

  async recall(query: string) {
    if (!this.namespace) return [];
    const out = await this.client.send(
      new RetrieveMemoryRecordsCommand({ memoryId: this.memoryId, namespace: this.namespace.replace('{actorId}', this.actorId), searchCriteria: { searchQuery: query, topK: 5 } }),
    );
    return (out.memoryRecordSummaries || []).map((r) => (r.content as any)?.text || '').filter(Boolean);
  }
}
