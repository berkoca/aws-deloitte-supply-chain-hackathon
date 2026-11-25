import { BedrockModel } from '@strands-agents/sdk';
import type { AgentConfig } from './config.js';

export function makeModels(cfg: AgentConfig) {
  const strong = () => new BedrockModel({ region: cfg.region, modelId: cfg.modelId, maxTokens: 3000 }) // Sonnet 5 temperature kabul etmiyor;
  const fast = () => new BedrockModel({ region: cfg.region, modelId: cfg.fastModelId, maxTokens: 2000, temperature: 0.4 });
  const signal = () => cfg.signalModelId ? new BedrockModel({ region: cfg.region, modelId: cfg.signalModelId, maxTokens: 1500, temperature: 0.2 }) : fast();
  /** Kullanıcıya açık asistan: guardrail tanımlıysa son kullanıcı mesajı ve yanıt denetlenir */
  const guarded = (voice = false) => new BedrockModel({ region: cfg.region, modelId: voice && cfg.voiceModelId ? cfg.voiceModelId : cfg.modelId, maxTokens: 3000,
    ...(cfg.guardrailId ? { guardrailConfig: { guardrailIdentifier: cfg.guardrailId, guardrailVersion: cfg.guardrailVersion, guardLatestUserMessage: true, trace: 'enabled' as const, streamProcessingMode: 'async' as const } } : {}) });
  return { strong, fast, signal, guarded };
}
