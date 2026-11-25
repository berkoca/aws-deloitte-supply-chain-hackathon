/**
 * Amazon Bedrock AgentCore Runtime giriş noktası.
 * Ajanlar (Strands Graph müzakeresi, asistan, karar yorumu) AgentCore Runtime'da oturum izolasyonlu çalışır.
 * Nest API (Lambda) bu runtime'ı InvokeAgentRuntime ile çağırır ve SSE akışını ön yüze aktarır.
 *   POST /invocations  { action: 'negotiate' | 'ask' | 'explain', ... }   GET /ping
 */
import { BedrockAgentCoreApp } from 'bedrock-agentcore/runtime';
import { z } from 'zod';
import { agentConfig } from './agents/config.js';
import { runNegotiation, type NegotiationEvent } from './agents/negotiation.js';
import { askAssistant, askAssistantStream, explainDecision } from './agents/assistant.js';
import { AgentCoreConstraintMemory } from './memory/agentcore.memory.js';
import { LocalConstraintMemory } from './memory/local.memory.js';
import { SHOCK_IDS } from './twin/sim.js';

const cfg = agentConfig();
const memory = cfg.memoryId ? new AgentCoreConstraintMemory(cfg.memoryId, cfg.region, cfg.memoryActorId, cfg.memoryNamespace || undefined) : new LocalConstraintMemory();

const Req = z.object({
  action: z.enum(['negotiate', 'ask', 'ask_stream', 'explain', 'warm']),
  snapshot: z.any().optional(),
  shock: z.enum(SHOCK_IDS).optional(),
  sessionId: z.string().optional(),
  question: z.string().max(500).optional(),
  history: z.array(z.object({ role: z.enum(['user', 'assistant']), text: z.string() })).optional(),
  voice: z.boolean().optional(),
  facts: z.string().max(4000).optional(),
});

/** Geri çağırma tabanlı bir işi SSE üretecine çevirir */
async function* pump(start: (emit: (e: any) => void) => Promise<unknown>) {
  const q: any[] = []; let wake: (() => void) | null = null; let done = false;
  const emit = (e: any) => { q.push(e); wake?.(); };
  const run = start(emit).catch((e: any) => emit({ type: 'error', message: `${e.name}: ${e.message}` })).finally(() => { done = true; wake?.(); });
  while (!done || q.length) {
    if (!q.length) await new Promise<void>((r) => (wake = r));
    wake = null;
    while (q.length) yield { data: q.shift() as any };
  }
  await run;
}

async function* negotiateStream(req: z.infer<typeof Req>) {
  const q: NegotiationEvent[] = []; let wake: (() => void) | null = null; let done = false;
  const emit = (e: NegotiationEvent) => { q.push(e); wake?.(); };
  const run = runNegotiation(req.snapshot, req.shock!, req.sessionId || 'anon', cfg, memory, emit)
    .catch((e: any) => emit({ type: 'error', message: `${e.name}: ${e.message}` }))
    .finally(() => { done = true; wake?.(); });
  while (!done || q.length) {
    if (!q.length) await new Promise<void>((r) => (wake = r));
    wake = null;
    while (q.length) yield { data: q.shift() as any };
  }
  await run;
}

const app = new BedrockAgentCoreApp({
  invocationHandler: {
    requestSchema: Req,
    // Müzakere SSE akışı döner; diğer eylemler tek JSON yanıtı
    process: (req) => {
      const sid = req.sessionId || 'anon';
      if (req.action === 'negotiate') return negotiateStream(req);
      if (req.action === 'ask_stream') return pump((emit) => askAssistantStream(req.snapshot, req.question || '', req.history || [], sid, cfg, memory, { voice: !!req.voice }, emit));
      return (async () => {
        if (req.action === 'warm') return { type: 'result', ok: true };
        if (req.action === 'ask') return { type: 'result', ...(await askAssistant(req.snapshot, req.question || '', req.history || [], sid, cfg, memory, { voice: !!req.voice })) };
        return { type: 'result', ...(await explainDecision(req.snapshot, req.facts || '', sid, cfg, memory)) };
      })();
    },
  },
});
app.run();
