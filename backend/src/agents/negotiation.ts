import { Graph } from '@strands-agents/sdk';
import { SHOCKS, Twin, type ActionId, type ShockId, type TwinSnapshot } from '../twin/sim.js';
import type { ConstraintMemory } from '../memory/memory.types.js';
import type { AgentConfig } from './config.js';
import { makeModels } from './model.js';
import { AGENT_NAMES, LINEUP, makeOrchestrator, makeSpecialist, type AgentId, type OrchestratorOut, type SpecialistOut } from './roster.js';
import { makeTwinTools } from './tools.js';

/** Ön yüze akan olaylar (SSE) */
export type NegotiationEvent =
  | { type: 'start'; agents: AgentId[]; model: string; fastModel: string; signalModel?: string }
  | { type: 'thinking'; id: AgentId }
  | { type: 'tool'; id: AgentId; tool: string }
  | { type: 'say'; id: AgentId; text: string; cls?: 'conflict' | 'decision'; label?: string; ms?: number; oneri?: string[] }
  | { type: 'plan'; shock: ShockId; actions: ActionId[]; why: string; decision: string; source: 'orchestrator' | 'fallback'; projection: { with: any; without: any } }
  | { type: 'trace'; steps: { id: AgentId; ms: number; tools: string[]; tokens?: number }[]; totalMs: number }
  | { type: 'error'; message: string }
  | { type: 'done' };

/**
 * Şok anında çoklu ajan müzakeresi (Strands Graph).
 *   1. dalga (sinyal) ─▶ 2. dalga (tartışma, paralel) ─▶ Orkestratör (plan + projeksiyon)
 */
export async function runNegotiation(
  snap: TwinSnapshot,
  shock: ShockId,
  sessionId: string,
  cfg: AgentConfig,
  memory: ConstraintMemory,
  emit: (e: NegotiationEvent) => void,
  signal?: AbortSignal,
) {
  const t0 = Date.now();
  const twin = new Twin(snap);
  twin.env.shocks[shock] = true; // şok bu istekle başladı
  const tools = makeTwinTools(twin, { shock, sessionId, memory });
  const models = makeModels(cfg);
  const allowed = twin.allowedActions(shock).map((p) => p.id);
  const { wave1, wave2 } = LINEUP[shock];

  const nodes = [
    ...wave1.map((id) => makeSpecialist(id as any, tools, models.signal())),
    ...wave2.map((id) => makeSpecialist(id as any, tools, models.fast())),
    makeOrchestrator(tools, models.strong(), allowed),
  ];
  const edges: [string, string][] = [];
  wave1.forEach((a) => wave2.forEach((b) => edges.push([a, b])));
  wave2.forEach((b) => edges.push([b, 'OR']));

  const graph = new Graph({ nodes, edges, sources: wave1, maxConcurrency: 6, timeout: cfg.negotiationTimeoutMs, nodeTimeout: cfg.negotiationTimeoutMs });
  emit({ type: 'start', agents: [...wave1, ...wave2, 'OR'], model: cfg.modelId, fastModel: cfg.fastModelId, signalModel: cfg.signalModelId || cfg.fastModelId });

  const task = `ŞOK: ${SHOCKS[shock].title}. Simülasyon saati ${twin.env.hour}. Ekip olarak bu şoka nasıl yanıt vereceğimizi tartışıyoruz. Kendi alanından görüşünü bildir.`;
  const trace = new Map<AgentId, { ms: number; tools: string[]; tokens?: number }>();
  let orch: OrchestratorOut | undefined;

  const stream = graph.stream(task, signal ? { cancelSignal: signal } : undefined);
  for await (const ev of stream as AsyncGenerator<any>) {
    const id = ev.nodeId as AgentId | undefined;
    if (ev.type === 'beforeNodeCallEvent' && id) {
      trace.set(id, { ms: 0, tools: [] });
      emit({ type: 'thinking', id });
    } else if (ev.type === 'nodeStreamUpdateEvent' && id) {
      const inner = ev.inner?.event;
      if (inner?.type === 'beforeToolCallEvent' && inner.toolUse?.name && !inner.toolUse.name.toLowerCase().includes('structured')) {
        trace.get(id)?.tools.push(inner.toolUse.name);
        emit({ type: 'tool', id, tool: inner.toolUse.name });
      }
    } else if (ev.type === 'nodeResultEvent' && id) {
      const res = ev.result;
      const t = trace.get(id) || { ms: 0, tools: [] };
      t.ms = res.duration; t.tokens = res.usage?.totalTokens; trace.set(id, t);
      if (res.status !== 'COMPLETED') { emit({ type: 'error', message: `${AGENT_NAMES[id]} yanıt veremedi: ${res.error?.message || res.status}` }); continue; }
      if (id === 'OR') { orch = res.structuredOutput as OrchestratorOut; continue; }
      const out = res.structuredOutput as SpecialistOut | undefined;
      const text = out?.mesaj || textOf(res.content);
      if (text) emit({ type: 'say', id, text, cls: out?.catisma ? 'conflict' : undefined, label: out?.catisma ? 'ÇATIŞMA' : undefined, ms: res.duration, oneri: out?.oneri });
    }
  }

  // Orkestratör çıktısını doğrula: yalnızca izinli aksiyonlar
  let actions = (orch?.aksiyonlar || []).filter((a) => allowed.includes(a)) as ActionId[];
  const source = orch && actions.length ? 'orchestrator' : 'fallback';
  if (!actions.length) actions = allowed as ActionId[];
  const projection = { with: twin.project(shock, actions), without: twin.project(shock, null) };
  emit({ type: 'plan', shock, actions, why: orch?.gerekce || 'Orkestratör seçenekleri atıl parça, talep karşılama, reddedilen tonaj ve brüt kâra göre puanladı.', decision: orch?.karar || 'Seçenekler puanlandı; öneri onay kartına gönderildi.', source, projection });
  emit({ type: 'trace', steps: [...trace.entries()].map(([id, v]) => ({ id, ...v })), totalMs: Date.now() - t0 });
  emit({ type: 'done' });
}

export function textOf(content: any[] | undefined): string {
  return (content || []).filter((b: any) => b.type === 'textBlock' && b.text).map((b: any) => b.text).join('\n').trim();
}
