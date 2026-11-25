import { tool } from '@strands-agents/sdk';
import { z } from 'zod';
import { ACTION_IDS, CH, KG, LINES, LORDER, PARTS, PREMIUM, SHOCKS, Twin, type ActionId, type ShockId } from '../twin/sim.js';
import type { ConstraintMemory } from '../memory/memory.types.js';

const r0 = (n: number) => Math.round(n);
const r1 = (n: number) => Math.round(n * 10) / 10;

/**
 * Ajanların ikizi okuduğu araçlar. Tüm sayılar sim çekirdeğinden hesaplanır;
 * model rakam üretmez, yalnızca yorumlar.
 */
export function makeTwinTools(twin: Twin, ctx: { shock?: ShockId; sessionId: string; memory: ConstraintMemory }) {
  const sim = twin.simA;
  const hour = twin.env.hour;

  const demandSignal = tool({
    name: 'talep_sinyali',
    description: 'Kanal ve parça bazında anlık taze et talebi (kg/sa), normal güne göre çarpan, aktif şoklar ve müşteri siparişleri (miktar, kalan süre, teslim yüzdesi).',
    inputSchema: z.object({}),
    callback: () => {
      const d = twin.demand(sim, hour);
      return {
        saat: hour,
        aktifSoklar: twin.activeShocks().map((s) => SHOCKS[s].title),
        parcalar: PARTS.map((p) => ({ parca: p.n, talepKgSa: r1(d[p.k]), sokCarpani: r1(twin.shockMult(p.k)) })),
        kanallar: CH.map((c) => ({ kanal: c.n, pay: c.s })),
        toplamTalepKgSa: r0(Object.values(d).reduce((a, b) => a + b, 0)),
        musteriSiparisleri: (twin.env.orders || []).filter((o: any) => !o.doneA || hour - o.doneA < 24).slice(-8).map((o: any) => ({
          siparis: o.id, musteri: o.cust, kanal: CH.find((c) => c.id === o.ch)?.n, parca: PARTS.find((p) => p.k === o.part)?.n, miktarKg: o.kg,
          kalanSaat: Math.max(0, o.due - hour), saatlikEkTalepKg: r0(twin.orderRate(o)),
          optisupplyTeslimYuzde: r0(Math.min(100, ((twin.simA.od || {})[o.id] || 0) / o.kg * 100)), bugunkuPlanTeslimYuzde: r0(Math.min(100, ((twin.simK.od || {})[o.id] || 0) / o.kg * 100)),
          durum: o.doneA ? 'teslim edildi' : o.late ? 'gecikti' : 'açık',
        })),
      };
    },
  });

  const carcassYield = tool({
    name: 'karkas_verim',
    description: 'Karkas parça verimleri, son saatin karşılanan/eksik parçaları ve stok gün sayısı. Ek karkas alımının fazla parça etkisini hesaplar.',
    inputSchema: z.object({}),
    callback: () => {
      const d = twin.demand(twin.simK, hour);
      let need = 0; PARTS.forEach((p) => { need = Math.max(need, d[p.k] / p.share); });
      const last = sim.last || {};
      const Rk = Math.min(twin.capKg('klasik'), need), extra = Math.max(0, Rk - (twin.simK.last?.R || 0));
      let excess = 0; PARTS.forEach((p) => { excess += Math.max(0, Rk * p.share - d[p.k]); });
      return {
        karkasKg: KG,
        parcalar: PARTS.map((p) => ({
          parca: p.n, verimPayi: p.share, premium: PREMIUM.includes(p.k),
          stokKg: r0(sim.stock[p.k]), stokSaat: r1(sim.stock[p.k] / Math.max(1, (last.d?.[p.k] || 1))),
          karsilamaYuzde: last.d ? r0(((last.served?.[p.k] || 0) / Math.max(1e-6, last.d[p.k])) * 100) : null,
        })),
        talebinTamaminiEkKarkaslaKarsilamak: { gerekenEkKarkasSaatte: r1(extra / KG), buKarkaslardanCikacakToplamIstenmeyenParcaKgSa: r0(excess), not: 'İstenmeyen parça tüm parçaların toplamıdır (kıymalık, but, ön parça vb.)' },
      };
    },
  });

  const lineCapacity = tool({
    name: 'hat_kapasitesi',
    description: 'Şarküteri hatlarının (sucuk, sosis-salam, burger-köfte) kapasite, sipariş hedefi ve son saatteki işleme miktarı.',
    inputSchema: z.object({}),
    callback: () => {
      const o = twin.opts(sim), last = sim.last || {};
      return {
        ekVardiyaOnayli: twin.flags().lineBoost,
        hatlar: LORDER.map((L) => ({ hat: LINES[L].n, kapasiteKgSa: LINES[L].cap, siparisKgSa: LINES[L].dem, hedefKgSa: r0(o.tgt[L]), islenenKgSa: r0(last.proc?.[L] || 0), girdiParcalar: LINES[L].parts.map((k) => PARTS.find((p) => p.k === k)!.n) })),
      };
    },
  });

  const prices = tool({
    name: 'fiyat_durumu',
    description: 'Parça bazında dinamik fiyat çarpanları, yönü (kıt/fazla/denge), fiyat esnekliği ve izin verilen fiyat koridoru.',
    inputSchema: z.object({}),
    callback: () => ({
      koridorYuzde: r0(twin.band() * 100),
      koridorGenisletmeOnayli: twin.flags().pricing,
      parcalar: PARTS.map((p) => ({ parca: p.n, fiyatDegisimYuzde: r1((sim.pm[p.k] - 1) * 100), durum: { up: 'kıt', down: 'fazla stok', eq: 'denge' }[sim.why?.[p.k] as string] || 'denge', esneklik: p.e })),
    }),
  });

  const supply = tool({
    name: 'tedarik_durumu',
    description: 'Canlı hayvan / karkas tedarik kapasitesi, alternatif besici durumu ve dış parça alım limiti.',
    inputSchema: z.object({}),
    callback: () => {
      const f = twin.flags(), o = twin.opts(sim);
      return {
        kapasiteKgSa: r0(twin.capKg('ajan')), kapasiteKarkasSa: r1(twin.capKg('ajan') / KG), normalKapasiteKarkasSa: 10,
        alternatifBesici: f.altSupplier ? 'aktif (maliyet +%6)' : 'pasif', disParcaAlimLimitiKgSa: o.buyCap,
        aktifSoklar: twin.activeShocks().map((s) => SHOCKS[s].title),
      };
    },
  });

  const coldStorage = tool({
    name: 'soguk_depo',
    description: 'Soğuk depo kapasitesi, doluluk yüzdesi, kalite reddi riski ve dondurucuya giden premium parça.',
    inputSchema: z.object({}),
    callback: () => ({
      kapasiteKg: r0(twin.storeCap('ajan')), dolulukYuzde: r0(sim.kpi?.fill || 0), stokKg: r0(sim.last?.stockTot || 0),
      kaliteReddiYuzdeSaatlik: r1(twin.qualRate('ajan') * 100), kaliteReddiAciklama: 'Saatte stoğun yüzde kaçının kalite nedeniyle reddedildiği', depoArizasi: !!twin.env.shocks.depo, ekDepoOnayli: twin.flags().storage,
      son24saatAtilKg: r0(sim.kpi?.atil || 0),
    }),
  });

  const kpis = tool({
    name: 'ikiz_gostergeleri',
    description: 'OptiSupply planı ile bugünkü (klasik) planın göstergeleri: son 24 saat (atıl parça, talep karşılama, reddedilen tonaj, brüt kâr, marj) ve hafta başından beri toplamlar (ek kâr).',
    inputSchema: z.object({}),
    callback: () => {
      const k = (s: any) => ({ atilKg: r0(s.kpi?.atil || 0), talepKarsilamaYuzde: r1(s.kpi?.serve || 0), reddedilenTon: r1(s.kpi?.rej || 0), brutKarBinTL: r0(s.kpi?.profit || 0), marjYuzde: r1(s.kpi?.margin || 0), depoDolulukYuzde: r0(s.kpi?.fill || 0) });
      const c = (s: any) => ({ saat: s.c?.h || 0, brutKarBinTL: r0((s.c?.profit || 0) / 1000), atilKg: r0(s.c?.atil || 0), karsilanmayanSiparisKg: r0(s.c?.talep || 0) });
      return { saat: hour, son24Saat: { optisupply: k(twin.simA), bugunkuPlan: k(twin.simK) }, haftaBasindanBeri: { optisupply: c(twin.simA), bugunkuPlan: c(twin.simK), ekKarBinTL: r0(((twin.simA.c?.profit || 0) - (twin.simK.c?.profit || 0)) / 1000) } };
    },
  });

  const projectPlan = tool({
    name: 'plani_projekte_et',
    description: 'Seçilen aksiyon setini dijital ikizde 24 saat ileri simüle eder ve plansız senaryoyla karşılaştırır. Planı önermeden önce mutlaka çağır.',
    inputSchema: z.object({ aksiyonlar: z.array(z.enum(ACTION_IDS)).describe('Uygulanacak aksiyon kimlikleri') }),
    callback: ({ aksiyonlar }) => {
      const s = ctx.shock!;
      const allowed = twin.allowedActions(s).map((p) => p.id);
      const acts = aksiyonlar.filter((a) => allowed.includes(a)) as ActionId[];
      const fmt = (x: any) => ({ brutKarBinTL: r0(x.profit), atilKg: r0(x.atil), talepKarsilamaYuzde: r1(x.serve), reddedilenTon: r1(x.rej), marjYuzde: r1(x.margin) });
      return { uygulananAksiyonlar: acts, reddedilenVeyaIzinsiz: aksiyonlar.filter((a) => !acts.includes(a)), planli: fmt(twin.project(s, acts)), plansiz: fmt(twin.project(s, null)) };
    },
  });

  const constraints = tool({
    name: 'hafizadaki_kisitlar',
    description: 'Yöneticinin daha önce gerekçesiyle reddettiği aksiyonlar (AgentCore Memory). Bu aksiyonlar tekrar önerilemez.',
    inputSchema: z.object({}),
    callback: async () => {
      const local = (twin.env.memory || []).map((m: any) => ({ aksiyon: m.flag, gerekce: m.q, zaman: m.at }));
      const [sess, learned] = await Promise.all([
        ctx.memory.list(ctx.sessionId).catch(() => []),
        ctx.memory.recall('reddedilen plan aksiyonları ve gerekçeleri').catch(() => []),
      ]);
      return { buOturum: local, buOturumAgentCore: sess.slice(-10), gecmisOturumlardanOgrenilen: learned, not: 'Yalnızca buOturum listesindeki aksiyonlar kesin yasaktır; geçmiş öğrenimleri gerekçede dikkate al.' };
    },
  });

  return { demandSignal, carcassYield, lineCapacity, prices, supply, coldStorage, kpis, projectPlan, constraints };
}
export type TwinTools = ReturnType<typeof makeTwinTools>;
