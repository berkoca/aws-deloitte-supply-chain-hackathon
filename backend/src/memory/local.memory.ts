import type { ConstraintMemory, ConstraintRecord } from './memory.types.js';

export class LocalConstraintMemory implements ConstraintMemory {
  readonly kind = 'local' as const;
  private store = new Map<string, ConstraintRecord[]>();
  async save(sessionId: string, rec: ConstraintRecord) {
    const l = this.store.get(sessionId) || [];
    l.push({ ...rec, ts: new Date().toISOString() });
    this.store.set(sessionId, l);
  }
  async list(sessionId: string) { return this.store.get(sessionId) || []; }
  async recall(query: string) {
    const all = [...this.store.values()].flat();
    return all.slice(-10).map((r) => `${r.flag}: ${r.reason}`);
  }
}
