import { Agent } from '@strands-agents/sdk';
import { z } from 'zod';
import { ACTION_IDS, type ShockId } from '../twin/sim.js';
import type { TwinTools } from './tools.js';

export type AgentId = 'OR' | 'TA' | 'VE' | 'UK' | 'FY' | 'TE' | 'LO' | 'TI';

export const AGENT_NAMES: Record<AgentId, string> = {
  OR: 'Orkestratör', TA: 'Talep Ajanı', VE: 'Karkas / Verim', UK: 'Ürün Karması',
  FY: 'Fiyat Ajanı', TE: 'Tedarik Ajanı', LO: 'Lojistik Ajanı', TI: 'Ticari Ajan',
};

const COMMON = `Pınar Et'in kırmızı et tedarik zinciri dijital ikizinde (OptiSupply) çalışan uzman bir yapay zekâ ajanısın.
Kurallar:
- Önce araçlarını çağır. Tüm rakamları YALNIZCA araç çıktılarından al; asla rakam uydurma.
- Ekip kanalına yazıyorsun: Türkçe, sade, en fazla 2 kısa cümle, en az bir somut rakam.
- Araç çıktısını aldıktan sonra uzun analiz yazma; doğrudan yapılandırılmış çıktıyı ver.
- Mesaja başlık, hitap ya da etiket koyma ("Ekip:", "Sağlık:" gibi); doğrudan bilgiyle başla. Birimleri araç çıktısındaki gibi yaz (kg/sa, kg, %, karkas/sa); kg değerini yüzde gibi yazma.
- Diğer ajanların söylediği rakamları tekrar etme; yalnızca KENDİ alanındaki yeni bilgiyi söyle.
- lineBoost kesimhanede değil, şarküteri hatlarında (sucuk, sosis-salam, burger-köfte) ek vardiyadır.
- Karkas bütün alınır: bir parçanın talebi için alınan hayvan diğer parçaları da üretir. Fazla parça şarküteri hatlarına gidebilir.
- Önerebileceğin aksiyon kimlikleri: partBuy (dış parça alımı), lineBoost (hatlarda ek vardiya), pricing (fiyat koridorunu ±%15'e aç), campaign (fazla parça kampanyası), storage (ek soğuk depo / transfer), altSupplier (alternatif besici).`;

/** Uzman ajanların ortak yapılandırılmış çıktısı */
export const SpecialistOut = z.object({
  mesaj: z.string().describe('Ekip kanalına yazacağın 1-2 kısa Türkçe cümle, araçtan gelen somut rakamla'),
  catisma: z.boolean().describe('Başka bir ajanın önerisine ya da talebin tamamını karşılama fikrine itiraz ediyorsan true'),
  oneri: z.array(z.enum(ACTION_IDS)).describe('Önerdiğin aksiyon kimlikleri (boş olabilir)'),
});
export type SpecialistOut = z.infer<typeof SpecialistOut>;

export const OrchestratorOut = z.object({
  aksiyonlar: z.array(z.enum(ACTION_IDS)).describe('Onaya gönderilecek aksiyon kimlikleri (yalnızca izinli olanlar)'),
  gerekce: z.string().describe('Onay kartında yöneticinin okuyacağı 2-3 cümlelik gerekçe; projeksiyon rakamlarıyla'),
  karar: z.string().describe('Ekip kanalına yazılacak tek cümlelik karar özeti'),
});
export type OrchestratorOut = z.infer<typeof OrchestratorOut>;

interface Spec { id: AgentId; role: string; tools: (t: TwinTools) => any[] }

const SPECS: Record<Exclude<AgentId, 'OR'>, Spec> = {
  TA: { id: 'TA', role: 'Talep Ajanı: yalnızca talep sinyalini raporlar (hangi parçada yüzde kaç artış, kaç kg/sa). Aksiyon önermez, oneri boş kalır.', tools: (t) => [t.demandSignal] },
  VE: { id: 'VE', role: 'Karkas / Verim Ajanı: parça verimlerini bilir. Talebin tamamını ek karkasla karşılamanın saatte kaç ek karkas ve kaç kg istenmeyen parça yaratacağını karkas_verim aracından söyler ve buna itiraz eder (catisma=true). Ek karkas yerine fiyat ve hat yönlendirmesini savunur.', tools: (t) => [t.carcassYield, t.coldStorage] },
  UK: { id: 'UK', role: 'Ürün Karması Ajanı: fazla parçayı (but, ön parça, kaburga, kıymalık, döş) sucuk, sosis-salam ve burger-köfte hatlarına nasıl yönlendireceğini ve hatlardaki boş kapasiteyi söyler.', tools: (t) => [t.lineCapacity, t.carcassYield] },
  FY: { id: 'FY', role: 'Fiyat Ajanı: kıt parçada (antrikot, kontrfile, bonfile gibi) fiyatı kaç puan artıracağını ve fazla parçada kaç puan indirim yapacağını söyler. Varsayılan koridor ±%8; ±%15\'e genişletmek (pricing) insan onayı ister.', tools: (t) => [t.prices] },
  TE: { id: 'TE', role: 'Tedarik Ajanı: canlı hayvan/karkas tedarik kapasitesini, alternatif besici seçeneğini ve dış parça alımını değerlendirir.', tools: (t) => [t.supply] },
  LO: { id: 'LO', role: 'Lojistik Ajanı: soğuk depo kapasitesi, doluluk, kalite reddi riski ve depolar arası transferden sorumludur.', tools: (t) => [t.coldStorage] },
  TI: { id: 'TI', role: 'Ticari Ajan: satış ekibinin sesidir; müşteri sözleşmelerini ve kanal önceliğini (HoReCa, perakende, PınarOnline) savunur. Genelde talebin tamamını karşılamayı ister, fazla parça için kampanya önerebilir.', tools: (t) => [t.demandSignal, t.kpis] },
};

/** Şoka göre müzakere kadrosu: 1. dalga sinyal toplar, 2. dalga tartışır, orkestratör karar verir. */
export const LINEUP: Record<ShockId, { wave1: AgentId[]; wave2: AgentId[] }> = {
  horeca: { wave1: ['TA'], wave2: ['TI', 'VE', 'FY', 'UK'] },
  kurban: { wave1: ['TA', 'TE'], wave2: ['LO', 'FY', 'UK'] },
  karantina: { wave1: ['TE'], wave2: ['VE', 'FY', 'UK'] },
  depo: { wave1: ['LO'], wave2: ['VE', 'FY', 'UK'] },
};

export function makeSpecialist(id: Exclude<AgentId, 'OR'>, tools: TwinTools, model: any) {
  const s = SPECS[id];
  return new Agent({
    id, name: AGENT_NAMES[id], description: s.role, model, printer: false,
    systemPrompt: `${COMMON}\nRolün: ${s.role}\nÖnceki ajanların mesajları girdide JSON olarak gelirse onlara yanıt ver; katılmıyorsan catisma=true yap.`,
    tools: s.tools(tools), structuredOutputSchema: SpecialistOut,
  });
}

export function makeOrchestrator(tools: TwinTools, model: any, allowed: string[]) {
  return new Agent({
    id: 'OR', name: AGENT_NAMES.OR, model, printer: false,
    description: 'Uzman ajanların görüşlerini toplayıp tek bir plan çıkarır ve insan onayına gönderir.',
    systemPrompt: `${COMMON}
Rolün: Orkestratör. Uzman ajanların mesajlarını tartıp tek bir plan çıkarırsın. Son kararı insan verir; sen onay kartına öneri gönderirsin.
Adımlar:
1) TEK TURDA, paralel olarak şunları çağır: hafizadaki_kisitlar, plani_projekte_et(tüm izinli aksiyonlar) ve plani_projekte_et(uzmanların en çok önerdiği daha küçük alt küme).
2) Brüt kâr, atıl parça, talep karşılama ve reddedilen tonaja göre en iyisini seç; ek araç çağırmadan yapılandırılmış çıktıyı ver.
3) Metinlerde aksiyon kimliği (partBuy vb.) yazma; Türkçe adını kullan: dış parça alımı, ek vardiya, fiyat koridoru, kampanya, ek depo, alternatif besici.
Bu şok için İZİNLİ aksiyonlar: ${allowed.join(', ') || 'yok'}. Bunların dışında aksiyon seçme.
Gerekçede projeksiyondaki rakamları kullan (planlı ve plansız karşılaştırması).`,
    tools: [tools.constraints, tools.projectPlan, tools.kpis],
    structuredOutputSchema: OrchestratorOut,
  });
}
