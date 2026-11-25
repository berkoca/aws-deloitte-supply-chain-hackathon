import { Agent } from '@strands-agents/sdk';
import { Twin, type TwinSnapshot } from '../twin/sim.js';
import type { ConstraintMemory } from '../memory/memory.types.js';
import type { AgentConfig } from './config.js';
import { makeModels } from './model.js';
import { makeTwinTools } from './tools.js';
import { textOf } from './negotiation.js';
import { makeKnowledgeTool } from './knowledge.js';
import { makeChartTool, type ChartSpec } from './charts.js';

const SYSTEM = `Sen OptiSupply asistanısın: Pınar Et kırmızı et tedarik zinciri dijital ikizinin sohbet asistanı.
Kullanıcı fabrika yöneticisi; sade Türkçe ile, kısa (en fazla 5 cümle) yanıt ver. Markdown, kalın yazı, başlık ya da madde işareti KULLANMA; düz metin yaz.
Rakamları YALNIZCA araçlardan al, asla uydurma. Gerekirse birden fazla araç çağır.
Kullanıcı grafik, tablo, trend, karşılaştırma ya da dağılım isterse grafik_goster aracını çağır; grafik sohbette otomatik çizilir, metinde rakamları tekrar sıralama, "grafik gösterildi/yüklendi" deme; doğrudan 1-2 cümlelik yorumla başla.
Araç çağırmadan önce hiçbir metin yazma ("bakıyorum" gibi giriş cümlesi yok); önce araçları çağır, sonra doğrudan yanıtı yaz.
Müşteri siparişleri talep_sinyali aracındadır; sipariş sorulursa teslim yüzdesini ve kalan süreyi söyle.
"OptiSupply planı" = yapay zekâ ajanlarının planı; "bugünkü plan" = klasik tonaj planı. Karşılaştırma yaparken ikisini de söyle.
Karkas bütün alınır: bir parçanın talebi için alınan hayvan diğer parçaları da üretir; fazla parça şarküteri hatlarına gider.
Fiyatlar ve parasal değerler örnektir (sentetik); miktar ve kapasiteler Pınar Et verisinden türetilmiştir.
Sesli yanıt istenirse madde işareti ve emoji kullanma, akıcı cümle kur.
Canlı rakamlar için ikiz araçlarını, kural/limit/onay/geçmiş aylık veri/ekran kullanımı soruları için bilgi_bankasi aracını kullan; bilgi bankasından aldığın bilgiyi kullanırken kaynağını kısaca belirt (ör. "HACCP planına göre").`;

type Hist = { role: 'user' | 'assistant'; text: string }[];
function makeAssistant(snap: TwinSnapshot, history: Hist, sessionId: string, cfg: AgentConfig, memory: ConstraintMemory, opts: { voice?: boolean; onChart?: (c: ChartSpec) => void }) {
  const twin = new Twin(snap);
  const t = makeTwinTools(twin, { sessionId, memory });
  return new Agent({
    id: 'assistant', name: 'OptiSupply asistanı', model: makeModels(cfg).guarded(!!opts.voice), printer: false,
    systemPrompt: SYSTEM + (opts.voice ? '\nBu yanıt sesli okunacak: en fazla 3 cümle.' : ''),
    tools: [t.kpis, t.demandSignal, t.carcassYield, t.prices, t.lineCapacity, t.coldStorage, t.supply, t.constraints, makeChartTool(twin, (c) => opts.onChart?.(c)), ...[makeKnowledgeTool(cfg)].filter(Boolean)] as any[],
    messages: history.slice(-6).map((m) => ({ role: m.role, content: [{ text: m.text }] })) as any,
  });
}

export async function askAssistant(snap: TwinSnapshot, question: string, history: Hist, sessionId: string, cfg: AgentConfig, memory: ConstraintMemory, opts: { voice?: boolean } = {}) {
  const charts: ChartSpec[] = [];
  const agent = makeAssistant(snap, history, sessionId, cfg, memory, { ...opts, onChart: (c) => charts.push(c) });
  const t0 = Date.now();
  const res = await agent.invoke(question);
  const guarded = String(res.stopReason || '').toLowerCase().includes('guardrail');
  return { answer: textOf(res.lastMessage.content) || res.toString(), ms: Date.now() - t0, ...(charts.length ? { charts } : {}), ...(guarded ? { guardrail: 'intervened' } : {}) };
}

/**
 * Akışlı yanıt (ChatGPT tarzı): araç çağrıları ve model metni geldikçe olay olarak iletilir.
 *   {type:'tool', name} · {type:'delta', text} · {type:'done', answer, ms, guardrail?}
 */
export async function askAssistantStream(snap: TwinSnapshot, question: string, history: Hist, sessionId: string, cfg: AgentConfig, memory: ConstraintMemory, opts: { voice?: boolean }, emit: (e: any) => void) {
  const agent = makeAssistant(snap, history, sessionId, cfg, memory, { ...opts, onChart: (c) => emit({ type: 'chart', chart: c }) });
  const t0 = Date.now(); let first = 0, text = '', result: any = null;
  for await (const ev of agent.stream(question) as AsyncGenerator<any>) {
    if (ev.type === 'beforeToolCallEvent' && ev.toolUse?.name) { if (text) { text = ''; first = 0; emit({ type: 'reset' }); } emit({ type: 'tool', name: ev.toolUse.name }); }
    else if (ev.type === 'modelStreamUpdateEvent' && ev.event?.type === 'modelContentBlockDeltaEvent' && ev.event.delta?.type === 'textDelta') {
      const d = ev.event.delta.text || ''; if (!d) continue;
      if (!first) first = Date.now() - t0;
      text += d; emit({ type: 'delta', text: d });
    } else if (ev.type === 'agentResultEvent') result = ev.result;
  }
  const guarded = String(result?.stopReason || '').toLowerCase().includes('guardrail');
  const answer = (result && textOf(result.lastMessage?.content)) || text;
  emit({ type: 'done', answer, ms: Date.now() - t0, firstTokenMs: first, ...(guarded ? { guardrail: 'intervened' } : {}) });
}

/** "Neden bu karar?" penceresi için kısa yapay zekâ yorumu. */
export async function explainDecision(snap: TwinSnapshot, facts: string, sessionId: string, cfg: AgentConfig, memory: ConstraintMemory) {
  const twin = new Twin(snap);
  const t = makeTwinTools(twin, { sessionId, memory });
  const agent = new Agent({
    id: 'explainer', name: 'Karar izi', model: makeModels(cfg).fast(), printer: false,
    systemPrompt: `Pınar Et kırmızı et dijital ikizinde üretim çözücüsünün kararını bir fabrika yöneticisine açıklıyorsun.
Karar izi tek bir saati (bir sonraki saat) anlatır. A, B, C aynı saat için üç farklı karkas alım miktarıdır: A = talebin tamamı (en çok istenen parçaya göre alım), B = ajan optimumu (seçilen), C = tonaj planı (+%8 tampon). Bunlar günlük plan karşılaştırması değildir.
3 cümle, düz Türkçe, markdown yok. Yalnızca verilen tablodaki rakamları aynen kullan; birimleri koru (₺/sa, kg/sa, karkas/sa); başka rakam türetme, yüzdeleri başka bir göstergeyle karıştırma.`,
    tools: [t.constraints],
  });
  const res = await agent.invoke(`Karar izi verisi:\n${facts}\nBu kararı açıkla.`);
  return { text: textOf(res.lastMessage.content) };
}
