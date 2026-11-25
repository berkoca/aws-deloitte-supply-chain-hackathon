/**
 * Dijital ikiz simülasyon çekirdeği (sunucu tarafı).
 *
 * Tarayıcıdaki ikizin saf fonksiyonlarının birebir kopyasıdır. Ajan araçları
 * (tools) tüm sayıları buradan hesaplar; dil modeli rakam uydurmaz.
 * Tarayıcı, durumunu (env + simA + simK + WI) anlık görüntü olarak gönderir.
 */

export const KG = 280;
export const PARTS = [
  { k: 'kiyma', n: 'Kıymalık', share: 0.2105, price: 1.0, c: '#D9735E', e: 1.3 },
  { k: 'on', n: 'Ön parça', share: 0.1684, price: 1.1, c: '#E8A764', e: 1.3 },
  { k: 'but', n: 'But', share: 0.1852, price: 1.2, c: '#B9473B', e: 1.3 },
  { k: 'dos', n: 'Döş', share: 0.0842, price: 0.9, c: '#F2CD94', e: 1.3 },
  { k: 'kab', n: 'Kaburga', share: 0.0842, price: 1.0, c: '#C98B74', e: 1.3 },
  { k: 'ant', n: 'Antrikot', share: 0.0505, price: 2.4, c: '#F07A9A', e: 0.7 },
  { k: 'kon', n: 'Kontrfile', share: 0.0421, price: 2.2, c: '#B98AF0', e: 0.7 },
  { k: 'bon', n: 'Bonfile', share: 0.0168, price: 3.0, c: '#8FB4FF', e: 0.7 },
] as const;
export type PartKey = (typeof PARTS)[number]['k'];
export const PK: Record<string, (typeof PARTS)[number]> = {};
PARTS.forEach((p) => (PK[p.k] = p));

export const BASE: Record<string, number> = { kiyma: 129.9, on: 89.1, but: 96.5, dos: 42.6, kab: 48.3, ant: 37.2, kon: 25.9, bon: 10.5 };
export const Y_RND = 0.155, Y_FIRE = 0.003, YI = 1.33, RND_Y = 0.572, RND_DEM = 185;
export const LINES: Record<string, { n: string; cap: number; dem: number; plan: number; lp: number; parts: string[]; to: string }> = {
  sucuk: { n: 'Sucuk hattı', cap: 750, dem: 427.5, plan: 0.838, lp: 1.35, parts: ['but', 'kiyma', 'dos'], to: 'ch_perakende' },
  kofte: { n: 'Sosis-salam hattı', cap: 889, dem: 537.4, plan: 0.882, lp: 1.15, parts: ['kiyma', 'dos', 'kab', 'on'], to: 'ch_online' },
  doner: { n: 'Donuk burger-köfte hattı', cap: 556, dem: 310.4, plan: 0.962, lp: 1.2, parts: ['kiyma', 'on', 'kab'], to: 'ch_horeca' },
};
export const LORDER = ['sucuk', 'kofte', 'doner'];
export const CH = [
  { id: 'ch_perakende', n: 'Perakende', s: 0.4 },
  { id: 'ch_horeca', n: 'HoReCa', s: 0.3 },
  { id: 'ch_ihracat', n: 'İhracat', s: 0.1 },
  { id: 'ch_online', n: 'PınarOnline', s: 0.2 },
];
export const PREMIUM = ['bon', 'ant', 'kon'];
export const V = 1.3, U = 400, C_PROC = 100, C_HOLD = 0.4, C_LOG = 15, CAP_BASE = 10 * KG, STORE_BASE = 8000;

/** Gün içi fiyat kuralı: talep / temel talep oranı bu eşikleri aşınca fiyat koridor içinde artar / iner */
export const PRICE_RULE = { hot: 1.02, cool: 0.82 };
export const ACTION_IDS = ['partBuy', 'lineBoost', 'pricing', 'campaign', 'storage', 'altSupplier'] as const;
export type ActionId = (typeof ACTION_IDS)[number];
export const SHOCK_IDS = ['horeca', 'kurban', 'karantina', 'depo'] as const;
export type ShockId = (typeof SHOCK_IDS)[number];

export interface PlanItem { id: ActionId; t: string; a: string }
export interface Shock {
  title: string; mult?: Record<string, number>; multAll?: number; capMult?: number; storeMult?: number; quality?: boolean; nodes: string[]; plan: PlanItem[];
}
export const SHOCKS: Record<ShockId, Shock> = {
  horeca: { title: 'HoReCa biftek talebi', mult: { ant: 1.6, kon: 1.4, bon: 1.3 }, nodes: ['ch_horeca'],
    plan: [{ id: 'partBuy', t: 'Sınırlı antrikot ve kontrfile parça alımı', a: 'Tedarik Ajanı' }, { id: 'lineBoost', t: 'Sucuk ve döner hattında ek vardiya', a: 'Ürün Karması Ajanı' }, { id: 'pricing', t: 'Fiyat koridorunu ±%15’e aç: kıt parçada artış, fazla parçada indirim', a: 'Fiyat Ajanı' }, { id: 'campaign', t: 'Fazla parça için PınarOnline kampanyası', a: 'Ticari Ajan' }] },
  kurban: { title: 'Kurban’a 3 hafta', multAll: 1.2, mult: { kiyma: 1.4 }, capMult: 0.85, nodes: ['supply', 'ch_perakende'],
    plan: [{ id: 'storage', t: 'Ek soğuk depo kapasitesi kirala', a: 'Lojistik Ajanı' }, { id: 'lineBoost', t: 'İşlenmiş ürünü erken üret (ek vardiya)', a: 'Ürün Karması Ajanı' }, { id: 'pricing', t: 'Sezon fiyat koridoru ±%15', a: 'Fiyat Ajanı' }] },
  karantina: { title: 'Bölgesel karantina', capMult: 0.6, nodes: ['supply'],
    plan: [{ id: 'altSupplier', t: 'Alımı alternatif besicilere kaydır', a: 'Tedarik Ajanı' }, { id: 'partBuy', t: 'Eksik premium parçayı parça olarak al', a: 'Tedarik Ajanı' }, { id: 'pricing', t: 'Kıt parçalarda fiyatı koridor içinde artır', a: 'Fiyat Ajanı' }] },
  depo: { title: 'Soğuk depo arızası', storeMult: 0.5, quality: true, nodes: ['depo'],
    plan: [{ id: 'storage', t: 'Rotamen ile diğer depoya transfer', a: 'Lojistik Ajanı' }, { id: 'lineBoost', t: 'Raf ömrü kısa partileri hatta çek', a: 'Ürün Karması Ajanı' }, { id: 'pricing', t: 'Fazla stokta hızlı indirim (±%15)', a: 'Fiyat Ajanı' }, { id: 'campaign', t: 'Hızlı dönen kanala kampanya', a: 'Ticari Ajan' }] },
};
export const FLAG_REASONS: Record<ActionId, string> = {
  partBuy: 'Dış parça alımında kalite riski var',
  storage: 'Ek depo maliyeti onaylı değil',
  campaign: 'Bu hafta kampanya bütçesi yok',
  altSupplier: 'Alternatif besici henüz denetlenmedi',
  lineBoost: 'Hatlarda ek vardiya açılamaz',
  pricing: 'Fiyat koridoru ±%8’i aşmamalı',
};
export const PLAN_TON: Record<ActionId, number> = {
  partBuy: 40 * 24, lineBoost: (427.5 + 537.4 + 310.4) * 0.15 * 24, storage: 3500, campaign: 0.18 * 1500 * 24 * 0.3,
  altSupplier: CAP_BASE * 0.45 * 0.3 * 24 * 0.25, pricing: 0.08 * 481 * 24 * 0.3,
};
const PLK = ['rf', 'rp', 'ck', 'cb', 'cp', 'ch', 'cl'];

/** Tarayıcıdan gelen anlık görüntü. Şekli tarayıcıdaki env/simA/simK nesneleridir. */
export interface TwinSnapshot {
  env: any;
  simA: any;
  simK: any;
  WI: { price: number; demand: number; store: number };
}

const clone = <T>(x: T): T => JSON.parse(JSON.stringify(x));
function daily(h: number) { const x = h % 24; return 0.8 + 0.35 * Math.max(0, Math.sin((Math.PI * (x - 6)) / 14)); }
function zc() { return { talep: 0, kalite: 0, kapasite: 0, rf: 0, rp: 0, ck: 0, cb: 0, cp: 0, ch: 0, cl: 0, profit: 0, lost: 0, pg: 0, proc: 0, atil: 0, served: 0, dem: 0, R: 0, h: 0 }; }

/**
 * Anlık görüntü üzerinde çalışan ikiz. Her çağrı kendi kopyası üzerinde çalışır,
 * tarayıcının durumu değişmez.
 */
export class Twin {
  env: any;
  simA: any;
  simK: any;
  WI: { price: number; demand: number; store: number };

  constructor(snap: TwinSnapshot) {
    this.env = clone(snap.env);
    this.env.shocks = this.env.shocks || {};
    this.env.approved = this.env.approved || {};
    this.env.memory = this.env.memory || [];
    this.env.rejPlan = this.env.rejPlan || [];
    this.env.orders = this.env.orders || [];
    this.simA = clone(snap.simA);
    this.simK = clone(snap.simK);
    this.WI = Object.assign({ price: 1, demand: 1, store: 1 }, snap.WI);
  }

  rejPlan24() { const h = this.env.hour; let s = 0; this.env.rejPlan.forEach((x: any) => { if (h - x.h < 24) s += x.kg; }); return s; }
  activeShocks(): ShockId[] { return Object.keys(this.env.shocks).filter((k) => this.env.shocks[k]) as ShockId[]; }
  shockMult(k: string) { let m = 1; this.activeShocks().forEach((s) => { const S = SHOCKS[s]; m *= S.mult && S.mult[k] != null ? S.mult[k] : S.multAll || 1; }); return m; }
  flags(): Record<ActionId, boolean> {
    const f: Record<ActionId, boolean> = { partBuy: true, lineBoost: false, campaign: false, storage: false, altSupplier: false, pricing: false };
    Object.keys(this.env.approved).forEach((s) => { if (!this.env.shocks[s]) return; this.env.approved[s].forEach((id: ActionId) => { f[id] = true; }); });
    this.env.memory.forEach((m: any) => { f[m.flag as ActionId] = false; });
    return f;
  }
  band() { return this.flags().pricing ? 0.15 : 0.08; }
  capKg(policy: string) { let c = CAP_BASE; this.activeShocks().forEach((s) => { if (SHOCKS[s].capMult) c *= SHOCKS[s].capMult!; }); if (policy === 'ajan' && this.flags().altSupplier) c *= 1.45; return c; }
  storeCap(policy: string) { let c = STORE_BASE * this.WI.store; this.activeShocks().forEach((s) => { if (SHOCKS[s].storeMult) c *= SHOCKS[s].storeMult!; }); if (policy === 'ajan' && this.flags().storage) c += 3500; return c; }
  qualRate(policy: string) { if (!this.env.shocks.depo) return 0; return policy === 'ajan' && this.flags().storage ? 0.003 : 0.012; }

  opts(sim: any) {
    const f = this.flags();
    const base: any = { store: this.storeCap(sim.policy), qual: this.qualRate(sim.policy), pm: sim.pm, tgt: {} };
    if (sim.policy === 'klasik') {
      base.lines = true; base.lineMult = 1; base.buyCap = 0; base.costR = 1;
      LORDER.forEach((L) => { base.tgt[L] = Math.min(LINES[L].cap, LINES[L].dem * this.WI.demand * LINES[L].plan); });
      return base;
    }
    base.lines = true; base.lineMult = f.lineBoost ? 1.15 : 1; base.buyCap = f.partBuy ? (f.lineBoost || f.altSupplier ? 40 : 16) : 0; base.costR = f.altSupplier ? 1.06 : 1;
    LORDER.forEach((L) => { base.tgt[L] = Math.min(LINES[L].cap * base.lineMult, LINES[L].dem * this.WI.demand); });
    return base;
  }

  demand(sim: any, h: number) {
    const d: Record<string, number> = {}; const f = this.flags();
    PARTS.forEach((p) => {
      let v = BASE[p.k] * daily(h) * this.shockMult(p.k) * this.WI.demand;
      if (sim.policy === 'ajan') { v *= Math.pow(sim.pm[p.k], -p.e); if (f.campaign && sim.stock[p.k] > v * 1.5) v *= 1.18; }
      d[p.k] = v;
    });
    const oa = this.orderAdd(h); PARTS.forEach((p) => { if (oa[p.k]) d[p.k] += oa[p.k]; });
    return d;
  }

  /** Müşteri siparişi: teslim süresine eşit yayılan sözleşmeli talep (fiyat esnekliği uygulanmaz) */
  orderRate(o: any) { return o.kg / Math.max(1, o.due - o.h0); }
  orderAdd(h: number) { const a: Record<string, number> = {}; (this.env.orders || []).forEach((o: any) => { if (h >= o.h0 && h < o.due) a[o.part] = (a[o.part] || 0) + this.orderRate(o); }); return a; }

  evalHour(stock: Record<string, number>, d: Record<string, number>, R: number, o: any) {
    const WI = this.WI;
    const r: any = { R, prod: {}, served: {}, rem: {}, bought: {}, procBy: {}, proc: { sucuk: 0, doner: 0, kofte: 0 }, inBy: { sucuk: {}, doner: {}, kofte: {} }, d, sumD: 0, sumS: 0, freshD: 0, freshS: 0, lsD: 0, lsS: 0, rejTalep: 0, tgt: o.tgt, toFz: 0 };
    const avail: Record<string, number> = {};
    PARTS.forEach((p) => { r.prod[p.k] = R * p.share; avail[p.k] = stock[p.k] + r.prod[p.k]; r.bought[p.k] = 0; r.procBy[p.k] = 0; });
    let left = o.buyCap;
    PREMIUM.forEach((k) => { const sh = d[k] - avail[k]; if (sh > 0 && left > 0) { const b = Math.min(sh, left); r.bought[k] = b; avail[k] += b; left -= b; } });
    PARTS.forEach((p) => { r.served[p.k] = Math.min(avail[p.k], d[p.k]); r.rem[p.k] = avail[p.k] - r.served[p.k]; r.freshD += d[p.k]; r.freshS += r.served[p.k]; r.rejTalep += Math.max(0, d[p.k] - r.served[p.k]); });
    LORDER.forEach((L) => {
      let need = o.tgt[L] || 0; const dem = LINES[L].dem * WI.demand;
      LINES[L].parts.forEach((k) => { if (need <= 0) return; const x = Math.min(need / YI, Math.max(0, r.rem[k])); if (x > 0) { r.rem[k] -= x; need -= x * YI; r.proc[L] += x * YI; r.procBy[k] += x; r.inBy[L][k] = (r.inBy[L][k] || 0) + x; } });
      const sold = Math.min(r.proc[L], dem); r.lsD += dem; r.lsS += sold; r.rejTalep += Math.max(0, dem - r.proc[L]);
    });
    r.fzBy = {}; PREMIUM.forEach((k) => { const keepK = 1.5 * d[k], x = Math.max(0, r.rem[k] - keepK); r.rem[k] -= x; r.toFz += x; r.fzBy[k] = x; });
    r.sumD = r.freshD + r.lsD; r.sumS = r.freshS + r.lsS;
    let tot = 0; PARTS.forEach((p) => { tot += r.rem[p.k]; });
    r.kalite = o.qual * tot; r.aging = 0.015 * (tot - r.kalite); r.over = Math.max(0, tot - r.kalite - r.aging - o.store);
    r.atil = r.aging + r.over;
    const lost = r.kalite + r.atil, keep = tot > 0 ? (tot - lost) / tot : 1;
    let rf = 0, rp = 0, cb = 0, pg = 0, pk = 0;
    r.revBy = {};
    PARTS.forEach((p) => {
      r.rem[p.k] *= keep;
      r.revBy[p.k] = r.served[p.k] * p.price * V * U * o.pm[p.k];
      rf += r.served[p.k] * p.price * V * U * o.pm[p.k];
      pg += r.served[p.k] * p.price * V * U * (o.pm[p.k] - 1);
      cb += r.bought[p.k] * p.price * V * U * 0.9;
      pk += r.procBy[p.k];
    });
    r.procMeat = pk; pk = r.proc.sucuk + r.proc.kofte + r.proc.doner;
    r.rndIn = R * Y_RND; r.rndOut = r.rndIn * RND_Y; r.rndSold = Math.min(r.rndOut, RND_DEM * WI.demand); r.fire = R * Y_FIRE;
    rp += r.rndSold * 0.15 * V * U;
    LORDER.forEach((L) => {
      const sold = Math.min(r.proc[L], LINES[L].dem * WI.demand), val = sold * LINES[L].lp * V * U; rp += val;
      let inT = 0; Object.keys(r.inBy[L]).forEach((k) => { inT += r.inBy[L][k]; }); inT = inT || 1; Object.keys(r.inBy[L]).forEach((k) => { r.revBy[k] += (val * r.inBy[L][k]) / inT; });
    });
    r.stockTot = tot * keep; r.store = o.store; r.procKg = pk;
    r.pl = { rf, rp, ck: R * o.costR * U * WI.price, cb, cp: pk * C_PROC, ch: r.stockTot * C_HOLD + r.toFz * U * 0.02, cl: (r.freshS + pk) * C_LOG };
    r.profit = rf + rp - r.pl.ck - cb - r.pl.cp - r.pl.ch - r.pl.cl;
    r.lost = (lost + r.fire) * U; r.pg = pg; r.net = r.profit;
    r.score = r.profit - 0.3 * U * lost - 0.25 * U * r.toFz;
    return r;
  }

  choose(sim: any, d: Record<string, number>, o: any) {
    const cap = this.capKg(sim.policy); let tot = 0;
    PARTS.forEach((p) => { tot += d[p.k]; }); LORDER.forEach((L) => { tot += o.tgt[L] || 0; });
    if (sim.policy === 'klasik') return Math.min(cap, tot * 1.08);
    const hi = Math.min(cap, tot * 1.6), lo = Math.min(cap, tot) * 0.6; let best: any = null;
    for (let i = 0; i <= 24; i++) { const R = lo + ((hi - lo) * i) / 24, e = this.evalHour(sim.stock, d, R, o); if (!best || e.score > best.score) best = e; }
    return best.R;
  }

  reprice(sim: any, r: any, h?: number) {
    const b = this.band();
    PARTS.forEach((p) => {
      const k = p.k, d = r.d[k] || 1, days = sim.stock[k] / (d * 24); let m = sim.pm[k];
      const base = BASE[k] * this.WI.demand, ratio = d / base; // gün içi talep eğrisi + şok + sipariş etkisi
      const hot = h != null && ((PREMIUM.indexOf(k) >= 0 && d > base * daily(h) * 1.25) || ratio > PRICE_RULE.hot);
      const cool = ratio < PRICE_RULE.cool;
      if (r.served[k] < d * 0.97 || hot) { m += 0.012; sim.why[k] = 'up'; }
      else if (days > 0.3 || cool) { m -= 0.012; sim.why[k] = 'down'; } // yalnız taze depoda biriken parçada indirim (dondurulan premium stok satılabilir)
      else { m += (1 - m) * 0.08; sim.why[k] = 'eq'; }
      sim.pm[k] = Math.max(1 - b, Math.min(1 + b, m));
    });
  }

  stepSim(sim: any, h: number) {
    const o = this.opts(sim), d = this.demand(sim, h), R = this.choose(sim, d, o), r = this.evalHour(sim.stock, d, R, o);
    sim.od = sim.od || {}; r.ordCh = {}; r.ordPart = {}; r.ordChPart = {};
    (this.env.orders || []).forEach((od: any) => {
      if (h < od.h0 || h >= od.due) return; const k = od.part, f = d[k] > 0 ? Math.min(1, r.served[k] / d[k]) : 1, kg = this.orderRate(od) * f;
      sim.od[od.id] = (sim.od[od.id] || 0) + kg; r.ordCh[od.ch] = (r.ordCh[od.ch] || 0) + kg; r.ordPart[k] = (r.ordPart[k] || 0) + kg;
      r.ordChPart[od.ch] = r.ordChPart[od.ch] || {}; r.ordChPart[od.ch][k] = (r.ordChPart[od.ch][k] || 0) + kg;
    });
    sim.stock = r.rem; sim.last = r; sim.fz = (sim.fz || 0) + r.toFz;
    if (sim.policy === 'ajan') this.reprice(sim, r, h);
    sim.c = sim.c || zc(); sim.win = sim.win || []; sim.hist = sim.hist || { atil: [], serve: [], rej: [], profit: [], margin: [], fill: [] };
    const c = sim.c; c.talep += r.rejTalep; c.kalite += r.kalite; c.kapasite += r.over;
    PLK.forEach((k) => { c[k] += r.pl[k]; });
    c.profit += r.profit; c.lost += r.lost; c.pg += r.pg; c.proc += r.procKg; c.atil += r.atil; c.served += r.sumS; c.dem += r.sumD; c.R += r.R; c.h++;
    sim.win.push({ d: r.sumD, s: r.sumS, a: r.atil, kk: R / KG, t: r.rejTalep, q: r.kalite, o: r.over, pr: r.profit, pl: r.pl });
    if (sim.win.length > 24) sim.win.shift();
    const W: any = { d: 0, s: 0, a: 0, k: 0, t: 0, q: 0, o: 0, pr: 0, pl: {} }; PLK.forEach((k) => { W.pl[k] = 0; });
    sim.win.forEach((w: any) => { W.d += w.d; W.s += w.s; W.a += w.a; W.k += w.kk; W.t += w.t; W.q += w.q; W.o += w.o; W.pr += w.pr; PLK.forEach((k) => { W.pl[k] += w.pl[k]; }); });
    const plan24 = sim.policy === 'ajan' ? this.rejPlan24() : 0, rev = W.pl.rf + W.pl.rp;
    sim.kpi = { atil: W.a, serve: W.d ? (W.s / W.d) * 100 : 100, fill: Math.min(100, (r.stockTot / o.store) * 100), value: W.k ? W.pr / W.k : 0,
      rej: (W.t + W.q + W.o + plan24) / 1000, rejB: { talep: W.t, kalite: W.q, kapasite: W.o, plan: plan24 },
      profit: W.pr / 1000, margin: rev ? (W.pr / rev) * 100 : 0, pl: W.pl, pr: W.pr, fz: sim.fz || 0 };
  }

  /** Şoka verilebilecek aksiyonlar: şokun aksiyon listesi eksi hafızadaki (reddedilmiş) kısıtlar. */
  allowedActions(s: ShockId): PlanItem[] {
    const mem = this.env.memory.map((m: any) => m.flag);
    return SHOCKS[s].plan.filter((p) => mem.indexOf(p.id) < 0);
  }

  /**
   * Bir aksiyon setiyle 24 saatlik projeksiyon (tarayıcıdaki project() ile aynı).
   * Kopya üzerinde çalışır; ikizin durumu değişmez.
   */
  project(s: ShockId, actions: ActionId[] | null) {
    const saveE = clone(this.env), saveA = clone(this.simA);
    if (actions && actions.length) this.env.approved[s] = actions.slice(); else delete this.env.approved[s];
    for (let i = 0; i < 24; i++) this.stepSim(this.simA, this.env.hour + i);
    const out = { atil: this.simA.kpi.atil, serve: this.simA.kpi.serve, rej: this.simA.kpi.rej, profit: this.simA.kpi.profit, margin: this.simA.kpi.margin };
    this.env = saveE; this.simA = saveA;
    return out;
  }
}
