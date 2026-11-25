// OptiSupply dijital ikiz birim testleri (node:test, ağ erişimi yok)
// Çalıştırma: npm run build && npm test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Twin, BASE, PARTS, LINES, LORDER, CAP_BASE, SHOCKS } from '../dist/twin/sim.js';
import { buildChart, CHART_KINDS } from '../dist/agents/charts.js';

const newSim = (policy) => {
  const stock = {}, pm = {}, why = {};
  PARTS.forEach((p) => { stock[p.k] = BASE[p.k] * 1.5; pm[p.k] = 1; why[p.k] = 'eq'; });
  return { policy, stock, pm, why, win: [], od: {}, fz: 0 };
};
const freshTwin = (env = {}) => new Twin({ env: { hour: 144, shocks: {}, approved: {}, memory: [], rejPlan: [], orders: [], ...env }, simA: newSim('ajan'), simK: newSim('klasik'), WI: { price: 1, demand: 1, store: 1 } });
const run = (t, n) => { for (let i = 0; i < n; i++) { t.stepSim(t.simA, t.env.hour); t.stepSim(t.simK, t.env.hour); t.env.hour++; } return t; };

test('determinizm: aynı başlangıç aynı sonuç', () => {
  const a = run(freshTwin(), 48), b = run(freshTwin(), 48);
  assert.equal(JSON.stringify(a.simA), JSON.stringify(b.simA));
  assert.equal(JSON.stringify(a.simK), JSON.stringify(b.simK));
});

test('fiyat koridoru: OptiSupply ±%8 içinde, bugünkü plan sabit', () => {
  const t = run(freshTwin(), 30);
  t.env.shocks.horeca = true; run(t, 24);
  t.env.shocks.horeca = false; run(t, 24);
  for (const p of PARTS) {
    assert.ok(t.simA.pm[p.k] >= 0.92 - 1e-9 && t.simA.pm[p.k] <= 1.08 + 1e-9, `${p.k} ${t.simA.pm[p.k]}`);
    assert.equal(t.simK.pm[p.k], 1);
  }
});

test('fiyat koridoru: onaylı pricing ile ±%15', () => {
  const t = run(freshTwin({ approved: { horeca: ['pricing'] } }), 10);
  t.env.shocks.horeca = true; run(t, 40);
  for (const p of PARTS) assert.ok(t.simA.pm[p.k] >= 0.85 - 1e-9 && t.simA.pm[p.k] <= 1.15 + 1e-9);
  assert.ok(Math.max(...PARTS.map((p) => t.simA.pm[p.k])) > 1.08, 'şokta premium fiyat %8 üstüne çıkabilmeli');
});

test('HoReCa şokunda premium fiyatlar artar', () => {
  const t = run(freshTwin(), 30);
  t.env.shocks.horeca = true; run(t, 12);
  for (const k of ['ant', 'kon', 'bon']) assert.ok(t.simA.pm[k] > 1, `${k} ${t.simA.pm[k]}`);
});

test('projeksiyon canlı durumu değiştirmez', () => {
  const t = run(freshTwin(), 30);
  t.env.shocks.horeca = true;
  const env0 = JSON.stringify(t.env), a0 = JSON.stringify(t.simA);
  const w = t.project('horeca', ['pricing', 'campaign']), wo = t.project('horeca', null);
  assert.equal(JSON.stringify(t.env), env0);
  assert.equal(JSON.stringify(t.simA), a0);
  for (const x of [w, wo]) for (const k of ['profit', 'atil', 'serve', 'rej', 'margin']) assert.ok(Number.isFinite(x[k]), k);
});

test('izinli aksiyonlar hafızadaki redleri dışlar', () => {
  const t = freshTwin({ memory: [{ flag: 'partBuy', q: 'kalite riski' }] });
  const ids = t.allowedActions('horeca').map((p) => p.id);
  assert.ok(!ids.includes('partBuy'));
  assert.deepEqual(ids, SHOCKS.horeca.plan.map((p) => p.id).filter((id) => id !== 'partBuy'));
});

test('bugünkü plan alımı = min(kapasite, toplam talep × 1,08)', () => {
  const t = run(freshTwin(), 5), sim = t.simK, o = t.opts(sim), d = t.demand(sim, t.env.hour);
  let tot = 0; PARTS.forEach((p) => { tot += d[p.k]; }); LORDER.forEach((L) => { tot += o.tgt[L]; });
  assert.equal(t.choose(sim, d, o), Math.min(CAP_BASE, tot * 1.08));
  LORDER.forEach((L) => assert.equal(o.tgt[L], Math.min(LINES[L].cap, LINES[L].dem * LINES[L].plan)));
});

test('karkas parça verimi: üretim = karkas × pay', () => {
  const t = run(freshTwin(), 3), r = t.simA.last;
  PARTS.forEach((p) => assert.ok(Math.abs(r.prod[p.k] - r.R * p.share) < 1e-9));
  for (const k of Object.keys(r.rem)) assert.ok(r.rem[k] >= -1e-9, `negatif stok ${k}`);
});

test('müşteri siparişi talebe eklenir ve teslim miktarı siparişi aşmaz', () => {
  const order = { id: 'S-1', cust: 'Test', ch: 'ch_horeca', part: 'ant', kg: 600, h0: 174, due: 186 };
  const base = freshTwin({ hour: 174 }), withOrder = freshTwin({ hour: 174, orders: [order] });
  const d0 = base.demand(base.simK, 174).ant, d1 = withOrder.demand(withOrder.simK, 174).ant;
  assert.ok(Math.abs(d1 - d0 - 50) < 1e-9, 'saatte 600/12 = 50 kg eklenmeli');
  run(withOrder, 20);
  for (const sim of [withOrder.simA, withOrder.simK]) assert.ok((sim.od['S-1'] || 0) <= 600 + 1e-6);
});

test('OptiSupply son 24 saatte bugünkü plandan daha az fire ve daha çok kâr üretir', () => {
  const t = run(freshTwin(), 72);
  assert.ok(t.simA.kpi.atil < t.simK.kpi.atil);
  assert.ok(t.simA.kpi.profit > t.simK.kpi.profit);
  assert.ok(t.simA.kpi.serve > t.simK.kpi.serve);
});

test('grafik aracı tüm türler için ikizden geçerli veri üretir', () => {
  const t = run(freshTwin(), 30);
  for (const kind of CHART_KINDS) {
    const c = buildChart(t, kind);
    assert.ok(c.title, kind);
    if (c.type === 'table') { assert.ok(c.rows.length > 0); continue; }
    for (const s of c.series) { assert.equal(s.values.length, c.labels.length, kind); s.values.forEach((v) => assert.ok(Number.isFinite(v), kind)); }
  }
  assert.equal(buildChart(t, 'saatlik_kar').labels.length, 24);
});
