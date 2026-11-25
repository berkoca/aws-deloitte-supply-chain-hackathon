export interface ConstraintRecord {
  flag: string;
  reason: string;
  shock?: string;
  at?: string;
  ts?: string;
}

/** Yöneticinin reddettiği aksiyonları tutan hafıza. Yerelde bellek içi, AWS'de AgentCore Memory. */
export interface ConstraintMemory {
  readonly kind: 'agentcore' | 'local';
  save(sessionId: string, rec: ConstraintRecord): Promise<void>;
  list(sessionId: string): Promise<ConstraintRecord[]>;
  /** Oturumlar arası öğrenilmiş kısıtlar (AgentCore uzun süreli hafıza stratejisi varsa). */
  recall(query: string): Promise<string[]>;
}
