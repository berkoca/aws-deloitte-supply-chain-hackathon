import { tool } from '@strands-agents/sdk';
import { z } from 'zod';
import { CH, LINES, LORDER, PARTS, Twin } from '../twin/sim.js';

/** Sohbette gösterilecek grafik / tablo tanımı (ön yüz SVG olarak çizer) */
export interface ChartSpec {
  type: 'bar' | 'hbar' | 'line' | 'table';
  title: string;
  unit?: string;
  labels?: string[];
  series?: { name: string; color: string; values: number[] }[];
  columns?: string[];
  rows?: (string | number)[][];
  note?: string;
}

export const CHART_KINDS = ['saatlik_kar', 'saatlik_atil', 'plan_karsilastirma', 'parca_fiyat', 'parca_stok', 'parca_talep', 'hat_doluluk', 'siparisler'] as const;
const A = '#1E9BC0', K = '#E98A3F';
const r1 = (n: number) => Math.round(n * 10) / 10;
const hh = (h: number) => `${String(((h % 24) + 24) % 24).padStart(2, '0')}:00`;

/** Grafik verisi doğrudan dijital ikizden hesaplanır; model rakam üretmez, yalnızca türü seçer. */
export function buildChart(twin: Twin, kind: (typeof CHART_KINDS)[number]): ChartSpec {
  const a = twin.simA, k = twin.simK, hour = twin.env.hour;
  const winLabels = (n: number) => Array.from({ length: n }, (_, i) => hh(hour - n + i));
  switch (kind) {
    case 'saatlik_kar': {
      const wa = a.win || [], wk = k.win || [];
      return { type: 'line', title: 'Saatlik brüt kâr · son 24 saat', unit: '₺ bin', labels: winLabels(wa.length),
        series: [{ name: 'OptiSupply', color: A, values: wa.map((w: any) => r1(w.pr / 1000)) }, { name: 'Bugünkü plan', color: K, values: wk.map((w: any) => r1(w.pr / 1000)) }] };
    }
    case 'saatlik_atil': {
      const wa = a.win || [], wk = k.win || [];
      return { type: 'line', title: 'Saatlik boşa giden parça · son 24 saat', unit: 'kg', labels: winLabels(wa.length),
        series: [{ name: 'OptiSupply', color: A, values: wa.map((w: any) => r1(w.a)) }, { name: 'Bugünkü plan', color: K, values: wk.map((w: any) => r1(w.a)) }] };
    }
    case 'plan_karsilastirma': {
      const f = (x: any) => x?.kpi || {};
      const ka = f(a), kk = f(k);
      const rows: (string | number)[][] = [
        ['Brüt kâr (₺ bin)', Math.round(ka.profit), Math.round(kk.profit)],
        ['Brüt marj (%)', r1(ka.margin), r1(kk.margin)],
        ['Talep karşılama (%)', r1(ka.serve), r1(kk.serve)],
        ['Boşa giden parça (kg)', Math.round(ka.atil), Math.round(kk.atil)],
        ['Reddedilen tonaj (t)', r1(ka.rej), r1(kk.rej)],
        ['Depo doluluğu (%)', Math.round(ka.fill), Math.round(kk.fill)],
      ];
      return { type: 'table', title: 'OptiSupply ve bugünkü plan · son 24 saat', columns: ['Gösterge', 'OptiSupply', 'Bugünkü plan'], rows };
    }
    case 'parca_fiyat':
      return { type: 'bar', title: 'Parça fiyat değişimi (OptiSupply)', unit: '%', labels: PARTS.map((p) => p.n),
        series: [{ name: 'Fiyat değişimi', color: A, values: PARTS.map((p) => r1((a.pm[p.k] - 1) * 100)) }], note: `Koridor ±%${Math.round(twin.band() * 100)}; bugünkü planda fiyat sabit.` };
    case 'parca_stok':
      return { type: 'bar', title: 'Taze depodaki parça stoku', unit: 'kg', labels: PARTS.map((p) => p.n),
        series: [{ name: 'OptiSupply', color: A, values: PARTS.map((p) => Math.round(a.stock[p.k])) }, { name: 'Bugünkü plan', color: K, values: PARTS.map((p) => Math.round(k.stock[p.k])) }] };
    case 'parca_talep': {
      const d = twin.demand(a, hour);
      return { type: 'bar', title: 'Anlık parça talebi', unit: 'kg/sa', labels: PARTS.map((p) => p.n), series: [{ name: 'Talep', color: A, values: PARTS.map((p) => r1(d[p.k])) }] };
    }
    case 'hat_doluluk': {
      const la = a.last || {}, lk = k.last || {};
      return { type: 'hbar', title: 'Şarküteri hatları doluluğu', unit: '%', labels: LORDER.map((L) => LINES[L].n),
        series: [{ name: 'OptiSupply', color: A, values: LORDER.map((L) => Math.round(((la.proc?.[L] || 0) / LINES[L].cap) * 100)) }, { name: 'Bugünkü plan', color: K, values: LORDER.map((L) => Math.round(((lk.proc?.[L] || 0) / LINES[L].cap) * 100)) }] };
    }
    case 'siparisler': {
      const os = (twin.env.orders || []).slice(-6);
      if (!os.length) return { type: 'table', title: 'Müşteri siparişleri', columns: ['Durum'], rows: [['Şu an sipariş yok']] };
      return { type: 'hbar', title: 'Müşteri siparişleri · teslim yüzdesi', unit: '%', labels: os.map((o: any) => `${o.id} ${o.cust}`),
        series: [{ name: 'OptiSupply', color: A, values: os.map((o: any) => Math.round(Math.min(100, ((a.od || {})[o.id] || 0) / o.kg * 100))) }, { name: 'Bugünkü plan', color: K, values: os.map((o: any) => Math.round(Math.min(100, ((k.od || {})[o.id] || 0) / o.kg * 100))) }],
        note: os.map((o: any) => `${o.id}: ${(o.kg / 1000).toLocaleString('tr-TR')} t ${PARTS.find((p) => p.k === o.part)?.n}, ${CH.find((c) => c.id === o.ch)?.n}`).join(' · ') };
    }
  }
}

export function makeChartTool(twin: Twin, onChart: (c: ChartSpec) => void) {
  return tool({
    name: 'grafik_goster',
    description: 'Sohbet penceresinde grafik ya da tablo gösterir. Veriyi dijital ikiz hesaplar. Türler: saatlik_kar (son 24 saat saatlik kâr, iki plan), saatlik_atil (saatlik boşa giden parça), plan_karsilastirma (iki planın göstergeleri tablo), parca_fiyat (parça fiyat değişimi), parca_stok (parça stoku), parca_talep (anlık parça talebi), hat_doluluk (şarküteri hat doluluğu), siparisler (müşteri siparişleri teslim yüzdesi). Kullanıcı grafik/tablo isterse ya da trend, karşılaştırma veya dağılım sorusunda kullan.',
    inputSchema: z.object({ tur: z.enum(CHART_KINDS).describe('Grafik türü') }),
    callback: ({ tur }) => {
      const c = buildChart(twin, tur);
      onChart(c);
      return { gosterildi: true, baslik: c.title, veri: c.type === 'table' ? c.rows : c.series?.map((s) => ({ seri: s.name, degerler: s.values.map((v, i) => `${c.labels?.[i]}: ${v}`) })) };
    },
  });
}
