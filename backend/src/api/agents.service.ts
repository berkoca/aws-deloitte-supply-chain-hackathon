import { Injectable, Logger } from '@nestjs/common';
import { BedrockRuntimeClient, ConverseCommand } from '@aws-sdk/client-bedrock-runtime';
import { PollyClient, SynthesizeSpeechCommand } from '@aws-sdk/client-polly';
import { agentConfig } from '../agents/config.js';
import { runNegotiation, type NegotiationEvent } from '../agents/negotiation.js';
import { askAssistant, askAssistantStream, explainDecision } from '../agents/assistant.js';
import { invokeAgentRuntime } from '../agents/runtime-client.js';
import { AgentCoreConstraintMemory } from '../memory/agentcore.memory.js';
import { LocalConstraintMemory } from '../memory/local.memory.js';
import type { ConstraintMemory, ConstraintRecord } from '../memory/memory.types.js';
import { SHOCK_IDS, type ShockId, type TwinSnapshot } from '../twin/sim.js';

@Injectable()
export class AgentsService {
  private readonly log = new Logger('Agents');
  readonly cfg = agentConfig();
  readonly memory: ConstraintMemory;
  private local = new LocalConstraintMemory();

  constructor() {
    this.memory = this.cfg.memoryId
      ? new AgentCoreConstraintMemory(this.cfg.memoryId, this.cfg.region, this.cfg.memoryActorId, this.cfg.memoryNamespace || undefined)
      : this.local;
    this.log.log(`Bölge=${this.cfg.region} model=${this.cfg.modelId} hızlı=${this.cfg.fastModelId} hafıza=${this.memory.kind}`);
  }

  isShock(s: string): s is ShockId { return (SHOCK_IDS as readonly string[]).includes(s); }

  /** AgentCore Runtime tanımlıysa oradan; hata olursa (henüz olay gelmediyse) API sürecinde çalıştırır. */
  async negotiate(snap: TwinSnapshot, shock: ShockId, sessionId: string, emit: (e: NegotiationEvent) => void, signal: AbortSignal) {
    if (this.cfg.runtimeArn) {
      let n = 0;
      try { await invokeAgentRuntime(this.cfg, { action: 'negotiate', snapshot: snap, shock, sessionId }, (e) => { n++; emit(e.type === 'start' ? { ...e, host: 'agentcore-runtime' } : e); }, signal); return; }
      catch (e: any) { this.log.warn(`AgentCore Runtime müzakeresi başarısız (${n} olay): ${e.name}: ${e.message}`); if (n > 0 || signal.aborted) throw e; }
    }
    return runNegotiation(snap, shock, sessionId, this.cfg, this.safeMemory(), emit, signal);
  }
  /** Akışlı asistan: AgentCore Runtime varsa oradan, yoksa (ya da olay gelmeden hata olursa) API sürecinde */
  async askStream(snap: TwinSnapshot, q: string, history: any[], sessionId: string, voice: boolean, emit: (e: any) => void, signal: AbortSignal) {
    if (this.cfg.runtimeArn) {
      let n = 0;
      try { await invokeAgentRuntime(this.cfg, { action: 'ask_stream', snapshot: snap, question: q, history: history || [], sessionId, voice }, (e) => { n++; emit(e.type === 'done' ? { ...e, host: 'agentcore-runtime' } : e); }, signal); return; }
      catch (e: any) { this.log.warn(`AgentCore Runtime akışlı asistan başarısız (${n} olay): ${e.name}: ${e.message}`); if (n > 0 || signal.aborted) throw e; }
    }
    return askAssistantStream(snap, q, history || [], sessionId, this.cfg, this.safeMemory(), { voice }, emit);
  }
  async ask(snap: TwinSnapshot, q: string, history: any[], sessionId: string, voice: boolean) {
    const r = await this.viaRuntime({ action: 'ask', snapshot: snap, question: q, history: history || [], sessionId, voice });
    return r || askAssistant(snap, q, history || [], sessionId, this.cfg, this.safeMemory(), { voice });
  }
  async explain(snap: TwinSnapshot, facts: string, sessionId: string) {
    const r = await this.viaRuntime({ action: 'explain', snapshot: snap, facts, sessionId });
    return r || explainDecision(snap, facts, sessionId, this.cfg, this.safeMemory());
  }
  /** Oturumun AgentCore Runtime mikro-VM'ini önceden başlatır (ilk müzakere ~4 sn kısalır). */
  async warm(sessionId: string) { const r = await this.viaRuntime({ action: 'warm', sessionId }); return { warmed: !!r, host: this.cfg.runtimeArn ? 'agentcore-runtime' : 'api' }; }
  private async viaRuntime(body: Record<string, unknown>): Promise<any | null> {
    if (!this.cfg.runtimeArn) return null;
    try { let res: any = null; await invokeAgentRuntime(this.cfg, body, (e) => { if (e.type === 'result') res = e; }); if (res) { delete res.type; res.host = 'agentcore-runtime'; } return res; }
    catch (e: any) { this.log.warn(`AgentCore Runtime çağrısı başarısız: ${e.name}: ${e.message}`); return null; }
  }

  async remember(sessionId: string, rec: ConstraintRecord) {
    await this.local.save(sessionId, rec);
    if (this.memory !== this.local) {
      try { await this.memory.save(sessionId, rec); } catch (e: any) { this.log.warn(`AgentCore Memory yazılamadı: ${e.message}`); return { stored: 'local', error: e.message }; }
    }
    return { stored: this.memory.kind };
  }
  async memories(sessionId: string) {
    try { return { kind: this.memory.kind, items: await this.memory.list(sessionId) }; }
    catch (e: any) { return { kind: 'local', items: await this.local.list(sessionId), error: e.message }; }
  }

  /** AgentCore erişilemezse yerel hafızaya düşer; demo durmaz. */
  private safeMemory(): ConstraintMemory {
    const m = this.memory, l = this.local;
    if (m === l) return l;
    return {
      kind: m.kind,
      save: (s, r) => m.save(s, r).catch(() => l.save(s, r)),
      list: (s) => m.list(s).catch(() => l.list(s)),
      recall: (q) => m.recall(q).catch(() => l.recall(q)),
    };
  }

  /** Amazon Polly ile Türkçe nöral ses (Burcu) */
  async speak(text: string): Promise<Buffer> {
    const polly = new PollyClient({ region: this.cfg.region });
    const out = await polly.send(new SynthesizeSpeechCommand({ Engine: 'neural', VoiceId: (process.env.POLLY_VOICE || 'Burcu') as any, LanguageCode: 'tr-TR', OutputFormat: 'mp3', Text: text.slice(0, 1500) }));
    return Buffer.from(await out.AudioStream!.transformToByteArray());
  }

  /** Ses + kelime zamanlamaları (speech marks): ön yüz metni sesle senkron açar. start/end UTF-8 bayt ofsetidir. */
  async speakWithMarks(text: string) {
    const t = text.slice(0, 1500);
    const polly = new PollyClient({ region: this.cfg.region });
    const voice = (process.env.POLLY_VOICE || 'Burcu') as any;
    const [audio, marks] = await Promise.all([
      this.speak(t),
      polly.send(new SynthesizeSpeechCommand({ Engine: 'neural', VoiceId: voice, LanguageCode: 'tr-TR', OutputFormat: 'json', SpeechMarkTypes: ['word'], Text: t }))
        .then(async (o) => (await o.AudioStream!.transformToString()).split('\n').filter(Boolean).map((l) => JSON.parse(l))),
    ]);
    return { text: t, audio: audio.toString('base64'), marks: marks.map((m: any) => ({ t: m.time, s: m.start, e: m.end })) };
  }

  async health(deep: boolean) {
    const out: any = { ok: true, region: this.cfg.region, model: this.cfg.modelId, fastModel: this.cfg.fastModelId, signalModel: this.cfg.signalModelId || this.cfg.fastModelId, memory: this.memory.kind, knowledgeBase: this.cfg.knowledgeBaseId || null, agentHost: this.cfg.runtimeArn ? 'agentcore-runtime' : 'api', framework: 'strands-agents' };
    if (deep) {
      const t0 = Date.now();
      try {
        const c = new BedrockRuntimeClient({ region: this.cfg.region });
        await c.send(new ConverseCommand({ modelId: this.cfg.fastModelId, messages: [{ role: 'user', content: [{ text: 'ping' }] }], inferenceConfig: { maxTokens: 5 } }));
        out.bedrock = { ok: true, ms: Date.now() - t0 };
      } catch (e: any) { out.ok = false; out.bedrock = { ok: false, error: e.name + ': ' + e.message }; }
    }
    return out;
  }
}
